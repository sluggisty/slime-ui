import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '../test/test-utils'
import { Card, StatCard } from './Card'
import { Activity } from 'lucide-react'

describe('Card', () => {
  it('renders children correctly', () => {
    render(<Card>Test Content</Card>)
    expect(screen.getByText('Test Content')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(<Card className="custom-class">Content</Card>)
    const cardElement = container.firstChild as HTMLElement
    expect(cardElement).toHaveClass('custom-class')
  })

  it('handles onClick events', () => {
    const handleClick = vi.fn()
    render(<Card onClick={handleClick}>Clickable</Card>)
    screen.getByText('Clickable').click()
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('does not call onClick when not provided', () => {
    render(<Card>Content</Card>)
    const content = screen.getByText('Content')
    // Should not throw when clicking without onClick handler
    expect(() => content.click()).not.toThrow()
  })

  it('applies hoverable class when hoverable is true', () => {
    const { container } = render(<Card hoverable>Content</Card>)
    const cardElement = container.firstChild as HTMLElement
    // Check that the element has the hoverable class applied
    // The actual CSS class name comes from the CSS module
    expect(cardElement.className).toContain('hoverable')
  })

  it('does not apply hoverable class when hoverable is false', () => {
    const { container } = render(<Card hoverable={false}>Content</Card>)
    const cardElement = container.firstChild as HTMLElement
    expect(cardElement.className).not.toContain('hoverable')
  })

  it('does not apply hoverable class when hoverable prop is not provided', () => {
    const { container } = render(<Card>Content</Card>)
    const cardElement = container.firstChild as HTMLElement
    expect(cardElement.className).not.toContain('hoverable')
  })
})

describe('StatCard', () => {
  it('renders title and value', () => {
    render(<StatCard title="Test Title" value="42" />)
    expect(screen.getByText('Test Title')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('renders numeric value correctly', () => {
    render(<StatCard title="Count" value={123} />)
    expect(screen.getByText('123')).toBeInTheDocument()
  })

  it('renders subtitle when provided', () => {
    render(<StatCard title="Title" value="42" subtitle="Subtitle Text" />)
    expect(screen.getByText('Subtitle Text')).toBeInTheDocument()
  })

  it('does not render subtitle when not provided', () => {
    const { container } = render(<StatCard title="Title" value="42" />)
    const subtitle = container.querySelector('.statSubtitle')
    expect(subtitle).not.toBeInTheDocument()
  })

  it('renders icon when provided', () => {
    const icon = <Activity data-testid="stat-icon" />
    render(<StatCard title="Title" value="42" icon={icon} />)
    expect(screen.getByTestId('stat-icon')).toBeInTheDocument()
  })

  it('does not render icon container when icon is not provided', () => {
    const { container } = render(<StatCard title="Title" value="42" />)
    // The icon container should not be rendered
    // We can check by ensuring the statIcon class is not present
    const iconContainer = container.querySelector('[class*="statIcon"]')
    expect(iconContainer).not.toBeInTheDocument()
  })

  it('applies default color class when color is not provided', () => {
    const { container } = render(<StatCard title="Title" value="42" />)
    const statCard = container.firstChild as HTMLElement
    // Should have the default statCard class, but not a color variant
    expect(statCard.className).toContain('statCard')
    expect(statCard.className).not.toContain('success')
    expect(statCard.className).not.toContain('warning')
    expect(statCard.className).not.toContain('error')
    expect(statCard.className).not.toContain('accent')
  })

  it('applies success color class correctly', () => {
    const { container } = render(<StatCard title="Title" value="42" color="success" />)
    const statCard = container.firstChild as HTMLElement
    expect(statCard.className).toContain('success')
  })

  it('applies warning color class correctly', () => {
    const { container } = render(<StatCard title="Title" value="42" color="warning" />)
    const statCard = container.firstChild as HTMLElement
    expect(statCard.className).toContain('warning')
  })

  it('applies error color class correctly', () => {
    const { container } = render(<StatCard title="Title" value="42" color="error" />)
    const statCard = container.firstChild as HTMLElement
    expect(statCard.className).toContain('error')
  })

  it('applies accent color class correctly', () => {
    const { container } = render(<StatCard title="Title" value="42" color="accent" />)
    const statCard = container.firstChild as HTMLElement
    expect(statCard.className).toContain('accent')
  })

  it('renders all props together correctly', () => {
    const icon = <Activity data-testid="full-stat-icon" />
    const { container } = render(
      <StatCard
        title="Complete Stat"
        value={999}
        subtitle="Full test"
        icon={icon}
        color="success"
      />
    )

    expect(screen.getByText('Complete Stat')).toBeInTheDocument()
    expect(screen.getByText('999')).toBeInTheDocument()
    expect(screen.getByText('Full test')).toBeInTheDocument()
    expect(screen.getByTestId('full-stat-icon')).toBeInTheDocument()

    const statCard = container.firstChild as HTMLElement
    expect(statCard.className).toContain('success')
  })
})

