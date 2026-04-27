import { useState } from 'react'
import { Navbar } from '../components/layout/Navbar'
import { useShoppingItems } from '../hooks/useShoppingItems'

export default function ShoppingPage() {
  const { items, loadError, addItem, toggleItem, deleteItem, clearDone } = useShoppingItems()
  const [input, setInput] = useState('')

  const unchecked = items.filter(i => !i.checked)
  const done = items.filter(i => i.checked)

  async function handleAdd() {
    const name = input.trim()
    if (!name) return
    await addItem(name).catch(e => console.warn('Failed to add item', e))
    setInput('')
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleAdd()
  }

  return (
    <div className="flex h-screen flex-col bg-gray-50 dark:bg-slate-900">
      <Navbar />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-lg px-4 py-6">

          {/* Error state */}
          {loadError && (
            <p className="mb-4 text-sm text-red-500">Failed to load shopping list.</p>
          )}

          {/* Add input */}
          <div className="mb-6 flex gap-2">
            <input
              className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder-gray-500"
              placeholder="Add an item..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button
              onClick={handleAdd}
              disabled={!input.trim()}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
            >
              Add
            </button>
          </div>

          {/* Unchecked items */}
          {unchecked.length === 0 && done.length === 0 && (
            <p className="text-sm text-gray-400 dark:text-gray-500">
              Your shopping list is empty. Add an item above.
            </p>
          )}
          <ul className="space-y-1">
            {unchecked.map(item => (
              <li key={item.id} className="flex items-center gap-3 rounded-lg bg-white px-3 py-2.5 shadow-sm dark:bg-slate-800">
                <input
                  type="checkbox"
                  checked={false}
                  onChange={() => toggleItem({ id: item.id, checked: true }).catch(e => console.warn('Failed to toggle item', e))}
                  className="h-4 w-4 cursor-pointer rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="flex-1 text-sm text-gray-800 dark:text-gray-200">{item.name}</span>
              </li>
            ))}
          </ul>

          {/* Done section */}
          {done.length > 0 && (
            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Done</span>
                <button
                  onClick={() => clearDone().catch(e => console.warn('Failed to clear done', e))}
                  className="text-xs text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400"
                >
                  Clear all
                </button>
              </div>
              <ul className="space-y-1">
                {done.map(item => (
                  <li key={item.id} className="flex items-center gap-3 rounded-lg bg-white px-3 py-2.5 shadow-sm dark:bg-slate-800">
                    <input
                      type="checkbox"
                      checked={true}
                      onChange={() => toggleItem({ id: item.id, checked: false }).catch(e => console.warn('Failed to toggle item', e))}
                      className="h-4 w-4 cursor-pointer rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="flex-1 text-sm text-gray-400 line-through dark:text-gray-500">{item.name}</span>
                    <button
                      onClick={() => deleteItem(item.id).catch(e => console.warn('Failed to delete item', e))}
                      className="text-gray-300 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400"
                      title="Delete item"
                    >
                      🗑
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
