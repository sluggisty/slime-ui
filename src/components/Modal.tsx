import { ReactNode } from 'react'
import { X } from 'lucide-react'
import styles from './Modal.module.css'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  // Alternative API for confirmation modals
  onConfirm?: () => void
  confirmText?: string
  cancelText?: string
  isConfirming?: boolean
  variant?: 'default' | 'danger'
}

export function Modal({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  footer,
  onConfirm,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isConfirming = false,
  variant = 'default'
}: ModalProps) {
  if (!isOpen) return null

  // Use footer if provided, otherwise use onConfirm pattern
  const modalFooter = footer || (onConfirm ? (
    <>
      <button
        className={variant === 'danger' ? styles.dangerButton : styles.cancelButton}
        onClick={onClose}
        disabled={isConfirming}
      >
        {cancelText}
      </button>
      <button
        className={variant === 'danger' ? styles.dangerButton : styles.confirmButton}
        onClick={onConfirm}
        disabled={isConfirming}
      >
        {isConfirming ? 'Processing...' : confirmText}
      </button>
    </>
  ) : null)

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>{title}</h2>
          <button className={styles.closeButton} onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className={styles.content}>
          {children}
        </div>
        {modalFooter && (
          <div className={styles.footer}>
            {modalFooter}
          </div>
        )}
      </div>
    </div>
  )
}


