import { forwardRef, useImperativeHandle } from 'react';
import { motion, useMotionValue, useTransform, useAnimation } from 'framer-motion';

export interface SwipeCardHandle {
  swipeLeft: () => Promise<void>;
  swipeRight: () => Promise<void>;
}

interface Props {
  children: React.ReactNode;
  stackIndex: number;
  onSwipe: (dir: 'left' | 'right') => void;
}

const THRESHOLD = 85;
const EXIT_DURATION = 0.26;

const SwipeCard = forwardRef<SwipeCardHandle, Props>(({ children, stackIndex, onSwipe }, ref) => {
  const isTop = stackIndex === 0;
  const x = useMotionValue(0);
  const controls = useAnimation();

  const rotate = useTransform(x, [-220, 220], [-18, 18]);
  const passOpacity  = useTransform(x, [-THRESHOLD, -30], [1, 0]);
  const applyOpacity = useTransform(x, [30, THRESHOLD], [0, 1]);

  const doSwipe = async (dir: 'left' | 'right') => {
    await controls.start({
      x: dir === 'right' ? 700 : -700,
      opacity: 0,
      rotate: dir === 'right' ? 20 : -20,
      transition: { duration: EXIT_DURATION, ease: [0.4, 0, 1, 1] },
    });
    onSwipe(dir);
  };

  useImperativeHandle(ref, () => ({
    swipeLeft:  () => doSwipe('left'),
    swipeRight: () => doSwipe('right'),
  }));

  const handleDragEnd = (_: never, info: { offset: { x: number } }) => {
    if      (info.offset.x >  THRESHOLD) doSwipe('right');
    else if (info.offset.x < -THRESHOLD) doSwipe('left');
    else controls.start({
      x: 0,
      rotate: 0,
      transition: { type: 'spring', stiffness: 420, damping: 28 },
    });
  };

  return (
    <motion.div
      className="absolute inset-0 touch-none"
      style={{
        x:      isTop ? x : 0,
        rotate: isTop ? rotate : 0,
        zIndex: 30 - stackIndex * 10,
      }}
      animate={isTop ? controls : {
        scale: 1 - stackIndex * 0.038,
        y: stackIndex * 14,
      }}
      transition={{ type: 'spring', stiffness: 350, damping: 28 }}
      drag={isTop ? 'x' : false}
      dragElastic={0.1}
      dragConstraints={{ left: 0, right: 0 }}
      dragTransition={{ bounceStiffness: 600, bounceDamping: 30 }}
      onDragEnd={isTop ? handleDragEnd : undefined}
      whileDrag={{ cursor: 'grabbing' }}
    >
      {/* PASS badge (left swipe) */}
      {isTop && (
        <motion.div
          style={{ opacity: passOpacity }}
          className="pointer-events-none absolute inset-0 rounded-3xl z-20 flex items-start justify-end p-5"
        >
          <div className="bg-red-500 text-white text-2xl font-black px-4 py-1 rounded-xl rotate-12 shadow-lg border-2 border-white/60">
            PASS
          </div>
        </motion.div>
      )}
      {/* APPLY badge (right swipe) */}
      {isTop && (
        <motion.div
          style={{ opacity: applyOpacity }}
          className="pointer-events-none absolute inset-0 rounded-3xl z-20 flex items-start justify-start p-5"
        >
          <div className="bg-emerald-500 text-white text-2xl font-black px-4 py-1 rounded-xl -rotate-12 shadow-lg border-2 border-white/60">
            APPLY ✓
          </div>
        </motion.div>
      )}

      {children}
    </motion.div>
  );
});

SwipeCard.displayName = 'SwipeCard';
export default SwipeCard;
