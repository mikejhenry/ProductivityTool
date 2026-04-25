import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@timeblock.app'

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const now = Date.now()
  const windowMs = 35_000 // 35s window to account for cron timing drift

  // Fetch blocks starting within the next 2 hours that have reminders set
  const { data: blocks, error } = await supabase
    .from('time_blocks')
    .select('id, user_id, title, start_time, reminder_minutes')
    .gte('start_time', new Date(now).toISOString())
    .lte('start_time', new Date(now + 2 * 60 * 60 * 1000).toISOString())
    .neq('reminder_minutes', '{}')

  if (error) return new Response(error.message, { status: 500 })
  if (!blocks?.length) return new Response('no blocks', { status: 200 })

  // Find reminders whose fire time falls within this cron window
  type Due = { userId: string; title: string; minutesBefore: number }
  const due: Due[] = []

  for (const block of blocks) {
    for (const mins of (block.reminder_minutes as number[])) {
      const fireAt = new Date(block.start_time).getTime() - mins * 60_000
      if (fireAt >= now - windowMs && fireAt <= now + windowMs) {
        due.push({ userId: block.user_id, title: block.title, minutesBefore: mins })
      }
    }
  }

  if (!due.length) return new Response('nothing due', { status: 200 })

  // Fetch push subscriptions for affected users
  const userIds = [...new Set(due.map(d => d.userId))]
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('user_id, endpoint, subscription')
    .in('user_id', userIds)

  if (!subs?.length) return new Response('no subscriptions', { status: 200 })

  // Send a Web Push for each due reminder × subscription
  const staleEndpoints: string[] = []

  await Promise.all(
    due.flatMap(d =>
      subs
        .filter(s => s.user_id === d.userId)
        .map(async s => {
          try {
            await webpush.sendNotification(
              s.subscription,
              JSON.stringify({
                title: d.title,
                body: `Starting in ${d.minutesBefore} minute${d.minutesBefore !== 1 ? 's' : ''}`,
                tag: `${d.userId}-${d.title}-${d.minutesBefore}`,
                url: '/app/today',
              })
            )
          } catch (e: any) {
            // 410 Gone = subscription expired, remove it
            if (e?.statusCode === 410) staleEndpoints.push(s.endpoint)
          }
        })
    )
  )

  if (staleEndpoints.length) {
    await supabase.from('push_subscriptions').delete().in('endpoint', staleEndpoints)
  }

  return new Response(`sent ${due.length} notification(s)`, { status: 200 })
})
