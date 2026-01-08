import React from 'react';
import styles from './Loading.module.css';

interface LoadingProps {
  message?: string;
  size?: 'small' | 'medium' | 'large';
  variant?: 'spinner' | 'dots' | 'pulse';
  fullScreen?: boolean;
}

/**
 * Loading component for lazy-loaded content and async operations
 */
export const Loading: React.FC<LoadingProps> = ({
  message = 'Loading...',
  size = 'medium',
  variant = 'spinner',
  fullScreen = false,
}) => {
  const containerClass = fullScreen ? styles.fullScreenContainer : styles.container;

  return (
    <div className={containerClass}>
      <div className={`${styles.loader} ${styles[size]} ${styles[variant]}`}>
        {variant === 'spinner' && (
          <div className={styles.spinner}>
            <div className={styles.spinnerInner}></div>
          </div>
        )}

        {variant === 'dots' && (
          <div className={styles.dots}>
            <div className={styles.dot}></div>
            <div className={styles.dot}></div>
            <div className={styles.dot}></div>
          </div>
        )}

        {variant === 'pulse' && <div className={styles.pulse}></div>}
      </div>

      {message && <p className={`${styles.message} ${styles[size]}`}>{message}</p>}
    </div>
  );
};

/**
 * Page-level loading component for route transitions
 */
export const PageLoading: React.FC<{ message?: string }> = ({ message = 'Loading page...' }) => (
  <Loading message={message} size='large' variant='spinner' fullScreen={true} />
);

/**
 * Component-level loading for smaller UI elements
 */
export const ComponentLoading: React.FC<{ message?: string }> = ({ message }) => (
  <Loading message={message} size='small' variant='dots' fullScreen={false} />
);

/**
 * Inline loading for buttons and small interactions
 */
export const InlineLoading: React.FC = () => (
  <div className={styles.inlineLoader}>
    <div className={styles.miniSpinner}></div>
  </div>
);

/**
 * Skeleton loading for content placeholders
 */
export const SkeletonLoading: React.FC<{
  lines?: number;
  width?: string | number;
  height?: string | number;
}> = ({ lines = 3, width = '100%', height = '1rem' }) => (
  <div className={styles.skeletonContainer}>
    {Array.from({ length: lines }, (_, index) => (
      <div
        key={index}
        className={styles.skeletonLine}
        style={{
          width: index === lines - 1 ? '60%' : width, // Last line shorter
          height,
        }}
      />
    ))}
  </div>
);
