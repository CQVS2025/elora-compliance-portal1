/**
 * GSAP setup for the app. Register the React hook once so useGSAP() works everywhere.
 * Use in Washout Compliance and other pages for entrance/stagger animations.
 */
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP);

export { gsap, useGSAP };

/** Default entrance animation options for washout pages */
export const WASHOUT_ANIM = {
  fadeUp: {
    opacity: 0,
    y: 18,
    duration: 0.4,
    ease: 'power2.out',
  },
  stagger: 0.06,
};
