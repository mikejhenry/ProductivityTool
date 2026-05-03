import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToggleSwitch } from '../components/settings/ToggleSwitch'

describe('ToggleSwitch', () => {
  it('renders with role="switch"', () => {
    render(<ToggleSwitch checked={false} onChange={() => {}} />)
    expect(screen.getByRole('switch')).toBeInTheDocument()
  })

  it('sets aria-checked="true" when checked=true', () => {
    render(<ToggleSwitch checked={true} onChange={() => {}} />)
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
  })

  it('sets aria-checked="false" when checked=false', () => {
    render(<ToggleSwitch checked={false} onChange={() => {}} />)
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false')
  })

  it('calls onChange when clicked', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ToggleSwitch checked={false} onChange={onChange} />)
    await user.click(screen.getByRole('switch'))
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('does not call onChange when disabled', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ToggleSwitch checked={false} disabled={true} onChange={onChange} />)
    await user.click(screen.getByRole('switch'))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('is disabled when disabled prop is true', () => {
    render(<ToggleSwitch checked={false} disabled={true} onChange={() => {}} />)
    expect(screen.getByRole('switch')).toBeDisabled()
  })
})
