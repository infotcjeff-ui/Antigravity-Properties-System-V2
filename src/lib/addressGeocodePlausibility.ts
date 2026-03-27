/**
 * 判斷地理編碼結果是否與使用者輸入的地址語意一致，
 * 避免「村／新界西北」被配到港島中環一代的預設點。
 */

/** 港島中環—金鐘一帶常見的「錯誤預設」範圍（與橫台山／錦田實際位置差約 20km） */
function isLikelyCentralDefaultPoint(lat: number, lng: number): boolean {
    return lat >= 22.275 && lat <= 22.295 && lng >= 114.152 && lng <= 114.178;
}

/** 明顯屬新界西北鄉郊語意（與中環不應共存） */
const NW_NT_STRONG = /橫台山|錦田|八鄉|流浮山|廈村|屏山|壆圍|大生圍|牛潭尾|新田|古洞|林錦公路|林村谷|丙崗/i;

/** 較寬鬆：新界／村落地點，不應落到港島軸線 */
const NT_OR_RURAL = /新界|散村|村$|鄉|元朗|屯門|天水圍|北區|大埔|沙田|西貢|葵涌|青衣|荃灣|將軍澳|離島|馬灣/i;

/**
 * @returns true 表示此座標可採用；false 表示應捨棄並嘗試下一筆結果
 */
export function isPlausibleGeocodeForQuery(query: string, lat: number, lng: number): boolean {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;

    const q = query.trim();
    if (!q) return true;

    if (NW_NT_STRONG.test(q)) {
        if (isLikelyCentralDefaultPoint(lat, lng)) return false;
        // 橫台山實際約 22.43N；中環約 22.28N
        if (lat < 22.33 && lng > 114.12) return false;
        return true;
    }

    if (NT_OR_RURAL.test(q) && !/中環|金鐘|灣仔|銅鑼灣|北角|柴灣|香港島|港島|尖沙咀|油尖旺|九龍城|觀塘/i.test(q)) {
        if (isLikelyCentralDefaultPoint(lat, lng)) return false;
    }

    return true;
}
