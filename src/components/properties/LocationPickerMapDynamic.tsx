'use client';

import dynamic from 'next/dynamic';

const LocationPickerMap = dynamic(() => import('./LocationPickerMap'), {
    ssr: false,
    loading: () => (
        <div className="w-full h-64 bg-zinc-100 dark:bg-white/5 animate-pulse rounded-xl mt-3 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
    )
});

export default LocationPickerMap;
