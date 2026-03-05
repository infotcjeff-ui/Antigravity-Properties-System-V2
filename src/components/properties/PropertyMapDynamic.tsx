'use client';

import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';

// Dynamically import the Leaflet map component with SSR disabled
const PropertyMap = dynamic(() => import('./PropertyMap'), {
    ssr: false,
    loading: () => (
        <div className="glass-card p-8 flex items-center justify-center h-[600px] bg-white dark:bg-white/5 rounded-2xl">
            <motion.div
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                className="w-10 h-10 rounded-full bg-purple-500"
            />
        </div>
    )
});

export default PropertyMap;
