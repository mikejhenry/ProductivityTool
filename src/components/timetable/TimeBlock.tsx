import { useDraggable } from '@dnd-kit/core'
import { TimeBlock as TBType } from '../../types'
import { hexToRgba } from '../../lib/colorUtils'

const STATUS_STYLE: Record<string, string> = {
  planned: 'opacity-100',
  completed: 'opacity-60 line-through',
  moved: 'opacity-50 italic',
  skipped: 'opacity-40',
}

interface Props {
  block: TBType
  topPercent: number
  heightPercent: number
  isDaily?: boolean
  onEdit: (block: TBType) => void
}

export function TimeBlock({ block, topPercent, heightPercent, isDaily = false, onEdit }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: block.id,
    data: { block },
  })

  const baseColor = block.color ?? '#6366f1'
  const bgColor = isDaily ? hexToRgba(baseColor, 0.25) : baseColor

  const style: React.CSSProperties = {
    top: `${topPercent}%`,
    height: `${Math.max(heightPercent, 1.5)}%`,
    minHeight: '20px',
    backgroundColor: bgColor,
    border: isDaily ? '1px dashed rgba(99,102,241,0.5)' : undefined,
    transform: transform ? `translate(${transform.x}px,${transform.y}px)` : undefined,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : isDaily ? 1 : 10,
  }

  const typeStyle = block.type === 'hard'
    ? 'border-l-4 border-l-white/60'
    : 'border-l-2 border-l-white/30'

  const textColor = isDaily ? 'text-indigo-700 dark:text-indigo-300' : 'text-white'

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`absolute left-0.5 right-0.5 cursor-grab overflow-hidden rounded px-1.5 py-0.5 select-none hover:brightness-110 transition-[filter] ${isDaily ? '' : typeStyle} ${STATUS_STYLE[block.status]} ${textColor}`}
      {...listeners}
      {...attributes}
      onDoubleClick={() => onEdit(block)}
    >
      <p className="truncate text-xs font-medium leading-tight">
        {isDaily ? '🔁 ' : ''}{block.title}
      </p>
    </div>
  )
}
