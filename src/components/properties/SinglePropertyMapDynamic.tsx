'use client';

import dynamic from 'next/dynamic';

const SinglePropertyMapDynamic = dynamic(
    () => import('./SinglePropertyMap'),
    { ssr: false }
);

export default SinglePropertyMapDynamic;
