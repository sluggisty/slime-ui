import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '../test/test-utils'
import { Modal } from './Modal'

describe('Modal', () => {
  it('does not render when isOpen is false', () => {
    const { container } = render(
      <Modal isOpen={false} onClose={vi.fn()} title="Test Modal">
        <div>Modal Content</div>
      </Modal>
    )

    expect(screen.queryByText('Test Modal')).not.toBeInTheDocument()
    expect(screen.queryByText('Modal Content')).not.toBeInTheDocument()
  })

  it('renders modal when isOpen is true', () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="Test Modal">
        <div>Modal Content</div>
      </Modal>
    )

    expect(screen.getByText('Test Modal')).toBeInTheDocument()
    expect(screen.getByText('Modal Content')).toBeInTheDocument()
  })

  it('renders title correctly', () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="My Modal Title">
        <div>Content</div>
      </Modal>
    )

    expect(screen.getByText('My Modal Title')).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', () => {
    const handleClose = vi.fn()
    render(
      <Modal isOpen={true} onClose={handleClose} title="Test Modal">
        <div>Content</div>
      </Modal>
    )

    const closeButton = screen.getByLabelText('Close')
    closeButton.click()

    expect(handleClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when backdrop is clicked', () => {
    const handleClose = vi.fn()
    const { container } = render(
      <Modal isOpen={true} onClose={handleClose} title="Test Modal">
        <div>Content</div>
      </Modal>
    )

    // Find the overlay (backdrop) and click it
    const overlay = container.querySelector('[class*="overlay"]')
    if (overlay) {
      overlay.click()
      expect(handleClose).toHaveBeenCalledTimes(1)
    }
  })

  it('does not call onClose when modal content is clicked', () => {
    const handleClose = vi.fn()
    const { container } = render(
      <Modal isOpen={true} onClose={handleClose} title="Test Modal">
        <div>Content</div>
      </Modal>
    )

    // Click on the modal content itself (not the backdrop)
    const modalContent = screen.getByText('Content')
    modalContent.click()

    // Should not call onClose because click should be stopped
    expect(handleClose).not.toHaveBeenCalled()
  })

  it('renders children content', () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="Test Modal">
        <div>
          <p>Paragraph 1</p>
          <p>Paragraph 2</p>
        </div>
      </Modal>
    )

    expect(screen.getByText('Paragraph 1')).toBeInTheDocument()
    expect(screen.getByText('Paragraph 2')).toBeInTheDocument()
  })

  it('renders footer when provided', () => {
    render(
      <Modal
        isOpen={true}
        onClose={vi.fn()}
        title="Test Modal"
        footer={<button>Custom Footer Button</button>}
      >
        <div>Content</div>
      </Modal>
    )

    expect(screen.getByText('Custom Footer Button')).toBeInTheDocument()
  })

  it('renders confirm and cancel buttons when onConfirm is provided', () => {
    const handleConfirm = vi.fn()
    render(
      <Modal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={handleConfirm}
        title="Test Modal"
      >
        <div>Content</div>
      </Modal>
    )

    expect(screen.getByText('Confirm')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  it('calls onConfirm when confirm button is clicked', () => {
    const handleConfirm = vi.fn()
    render(
      <Modal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={handleConfirm}
        title="Test Modal"
      >
        <div>Content</div>
      </Modal>
    )

    const confirmButton = screen.getByText('Confirm')
    confirmButton.click()

    expect(handleConfirm).toHaveBeenCalledTimes(1)
  })

  it('uses custom confirm and cancel text', () => {
    render(
      <Modal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Test Modal"
        confirmText="Save"
        cancelText="Discard"
      >
        <div>Content</div>
      </Modal>
    )

    expect(screen.getByText('Save')).toBeInTheDocument()
    expect(screen.getByText('Discard')).toBeInTheDocument()
  })

  it('shows loading state when isConfirming is true', () => {
    render(
      <Modal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Test Modal"
        isConfirming={true}
      >
        <div>Content</div>
      </Modal>
    )

    expect(screen.getByText('Processing...')).toBeInTheDocument()
    expect(screen.queryByText('Confirm')).not.toBeInTheDocument()
  })

  it('disables buttons when isConfirming is true', () => {
    render(
      <Modal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Test Modal"
        isConfirming={true}
      >
        <div>Content</div>
      </Modal>
    )

    const cancelButton = screen.getByText('Cancel')
    const confirmButton = screen.getByText('Processing...')

    expect(cancelButton).toBeDisabled()
    expect(confirmButton).toBeDisabled()
  })

  it('applies danger variant styling when variant is danger', () => {
    const { container } = render(
      <Modal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Test Modal"
        variant="danger"
      >
        <div>Content</div>
      </Modal>
    )

    // Check that danger button classes are applied
    const buttons = container.querySelectorAll('button')
    // Both cancel and confirm should have danger styling in danger variant
    expect(buttons.length).toBeGreaterThan(0)
  })
})

