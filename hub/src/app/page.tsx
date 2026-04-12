'use client';

import dynamic from 'next/dynamic';

// The VR canvas must not SSR — Three.js and WebXR are browser-only
const VRApp = dynamic(() => import('../scenes/VRApp'), { ssr: false });

export default function Home() {
  return <VRApp />;
}
