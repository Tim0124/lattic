import { useEffect } from 'react'
import { motion, stagger, useAnimate } from 'motion/react'
import { cn } from '../../lib/utils'

/**
 * Aceternity UI — Text Generate Effect（改為逐字元，支援中文）。
 * gradient 模式下漸層放在每個 span 並以 background-position 切片，
 * 因為 background-clip: text 放父層會被子層的 filter 動畫破壞（Chrome 行為）。
 */
export function TextGenerateEffect({
  words,
  className,
  gradient = false,
  duration = 0.5
}: {
  words: string
  className?: string
  gradient?: boolean
  duration?: number
}): React.JSX.Element {
  const [scope, animate] = useAnimate()
  const chars = Array.from(words)

  useEffect(() => {
    animate('span', { opacity: 1, filter: 'blur(0px)' }, { duration, delay: stagger(0.06) })
  }, [words, duration, animate])

  return (
    <div className={cn('font-bold', className)}>
      <motion.div ref={scope}>
        {chars.map((ch, i) => (
          <motion.span
            key={i}
            className={cn(
              'opacity-0',
              gradient && 'from-primary to-secondary bg-gradient-to-r bg-clip-text text-transparent'
            )}
            style={{
              filter: 'blur(10px)',
              ...(gradient
                ? { backgroundSize: `${chars.length}em 100%`, backgroundPosition: `${-i}em 0` }
                : {})
            }}
          >
            {ch}
          </motion.span>
        ))}
      </motion.div>
    </div>
  )
}
