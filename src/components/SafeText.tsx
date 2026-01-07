import React from 'react'
import { sanitizeHtml } from '../utils/validation'

interface SafeTextProps {
  content: string
  as?: keyof JSX.IntrinsicElements
  className?: string
  title?: string
}

/**
 * SafeText component for rendering user-generated content with XSS protection
 * Automatically sanitizes HTML and prevents XSS attacks
 */
export const SafeText: React.FC<SafeTextProps> = ({
  content,
  as: Component = 'span',
  className,
  title,
  ...props
}) => {
  // Sanitize the content to prevent XSS
  const safeContent = sanitizeHtml(content)

  return React.createElement(
    Component,
    {
      className,
      title,
      ...props,
      dangerouslySetInnerHTML: { __html: safeContent }
    }
  )
}

interface SafeValueProps {
  value: string | number | null | undefined
  fallback?: string
  as?: keyof JSX.IntrinsicElements
  className?: string
  title?: string
}

/**
 * SafeValue component for displaying data values safely
 * Handles null/undefined values and sanitizes content
 */
export const SafeValue: React.FC<SafeValueProps> = ({
  value,
  fallback = 'N/A',
  as: Component = 'span',
  className,
  title,
  ...props
}) => {
  const displayValue = value != null ? String(value) : fallback
  const safeContent = sanitizeHtml(displayValue)

  return React.createElement(
    Component,
    {
      className,
      title,
      ...props,
      dangerouslySetInnerHTML: { __html: safeContent }
    }
  )
}

interface TruncatedTextProps {
  content: string
  maxLength?: number
  as?: keyof JSX.IntrinsicElements
  className?: string
  showFullOnHover?: boolean
}

/**
 * TruncatedText component for displaying long text with truncation
 * Includes XSS protection and optional full text on hover
 */
export const TruncatedText: React.FC<TruncatedTextProps> = ({
  content,
  maxLength = 50,
  as: Component = 'span',
  className,
  showFullOnHover = true,
  ...props
}) => {
  const safeContent = sanitizeHtml(content)
  const truncatedContent = safeContent.length > maxLength
    ? safeContent.substring(0, maxLength) + '...'
    : safeContent

  const title = showFullOnHover && safeContent.length > maxLength ? content : undefined

  return React.createElement(
    Component,
    {
      className,
      title,
      ...props,
      dangerouslySetInnerHTML: { __html: truncatedContent }
    }
  )
}

// Utility function for direct sanitization
export const sanitizeAndRender = (content: string): { __html: string } => {
  return { __html: sanitizeHtml(content) }
}

// Type guard for safe content
export const isSafeContent = (content: string): boolean => {
  const originalLength = content.length
  const sanitizedLength = sanitizeHtml(content).length

  // If sanitization significantly changed the content, it might be unsafe
  return Math.abs(originalLength - sanitizedLength) / originalLength < 0.1
}
