import type { Variants } from "framer-motion";

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    transition: { duration: 0.22, ease: "easeOut" },
    y: 0,
  },
};

export const subtleScaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.98 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.2, ease: "easeOut" },
  },
};

export const toastMotion = {
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.98, y: 10 },
  initial: { opacity: 0, scale: 0.98, y: 14 },
  transition: { duration: 0.18, ease: "easeOut" },
} as const;

