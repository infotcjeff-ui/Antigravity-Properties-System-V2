'use client';

import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import type { Property } from '@/lib/db';

interface PropertyMapDynamicProps {
    properties: Property[];
    onPropertyClick?: (property: Property) => void;
}

// Dynamically import the Leaflet map component with SSR disabled
const PropertyMap = dynamic(() => import('./PropertyMap'), {
    ssr: false,
    loading: () => (
        <div className="glass-card p-8 flex items-center justify-center bg-white dark:bg-white/5 rounded-2xl" style={{ height: '100%' }}>
            <motion.div
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                className="w-10 h-10 rounded-full bg-purple-500"
            />
        </div>
    )
});

export default function PropertyMapDynamic(props: PropertyMapDynamicProps) {
    return <PropertyMap {...props} />;
}
