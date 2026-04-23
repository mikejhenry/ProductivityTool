import { useDraggable } from '@dnd-kit/core'
import { TimeBlock as TBType } from '../../types'

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
  onEdit: (block: TBType) => void
}

export function TimeBlock({ block, topPercent, heightPercent, onEdit }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: block.id,
    data: { block },
  })

  const style: React.CSSProperties = {
    top: `${topPercent}%`,
    height: `${Math.max(heightPercent, 1.5)}%`,
    minHeight: '20px',
    backgroundColor: block.color ?? '#6366f1',
    transform: transform ? `translate(${transform.x}px,${transform.y}px)` : undefined,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 10,
  }

  const typeStyle = block.type === 'hard'
    ? 'border-l-4 border-l-white/60'
    : 'border-l-2 border-l-white/30'

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`absolute left-0.5 right-0.5 cursor-grab overflow-hidden rounded px-1.5 py-0.5 text-white select-none ${typeStyle} ${STATUS_STYLE[block.status]}`}
      {...listeners}
      {...attributes}
      onDoubleClick={() => onEdit(block)}
    >
      <p className="truncate text-xs font-medium leading-tight">{block.title}</p>
    </div>
  )
}
