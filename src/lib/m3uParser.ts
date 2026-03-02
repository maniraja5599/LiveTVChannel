export interface Channel {
    id: string;
    name: string;
    logo: string;
    category: string;
    url: string;
    language?: string;
    drmInfo?: {
        licenseUrl?: string;
        drmType?: 'widevine' | 'clearkey' | 'playready';
    };
}

const LANG_MAP: Record<string, string> = {
    'tam': 'Tamil',
    'eng': 'English',
    'hin': 'Hindi',
    'tel': 'Telugu',
    'mal': 'Malayalam',
    'kan': 'Kannada',
    'ben': 'Bengali',
    'mar': 'Marathi',
    'guj': 'Gujarati',
    'pun': 'Punjabi',
};

const KNOWN_LANGUAGES = Object.values(LANG_MAP);

const TAMIL_KEYWORDS = [
    'tamil', 'sun tv', 'sun news', 'sun music', 'sun life', 'ktv', 'chutti', 'adithya',
    'jaya tv', 'jaya max', 'jaya plus', 'j movie',
    'vijay tv', 'star vijay', 'vijay super', 'vijay takkar',
    'kalaignar', 'seithigal', 'murasu', 'sirippoli', 'chithiram',
    'polimer', 'puthiyathalaimurai', 'thanthi', 'news7', 'news18 tamil',
    'vasanth', 'mega tv', 'captain', 'raj tv', 'raj news', 'raj musix',
    'zee tamil', 'colors tamil', 'vendhar', 'makkal', 'peppers', 'mk tv', 'sathiyam', 'dd podhigai'
];

const ENGLISH_KEYWORDS = [
    'english', 'movies now', 'mnx', 'romedy now', 'star movies', 'sony pix', '&flix',
    'cnn', 'bbc', 'al jazeera', 'republic tv', 'times now', 'india today', 'ndtv 24x7', 'mirror now', 'wion',
    'discovery', 'national geographic', 'nat geo', 'animal planet', 'history tv', 'tlc', 'travel xp'
];

function detectLanguage(id: string, name: string, category: string): string | undefined {
    const textToCheck = `${id} ${name} ${category}`.toLowerCase();

    // Check specific languages via robust keywords first
    if (TAMIL_KEYWORDS.some(kw => textToCheck.includes(kw))) return 'Tamil';
    if (ENGLISH_KEYWORDS.some(kw => textToCheck.includes(kw))) return 'English';

    // Fallback to simple contained text
    for (const lang of KNOWN_LANGUAGES) {
        if (textToCheck.includes(lang.toLowerCase())) {
            return lang;
        }
    }
    return undefined;
}

export async function fetchAndParseM3U(url: string): Promise<Channel[]> {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch playlist');
        const text = await response.text();

        const lines = text.split('\n');
        const channels: Channel[] = [];

        let currentChannel: Partial<Channel> = {};

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            if (line.startsWith('#EXTINF:')) {
                const logoMatch = line.match(/tvg-logo="([^"]+)"/);
                const groupMatch = line.match(/group-title="([^"]+)"/);
                const idMatch = line.match(/tvg-id="([^"]+)"/);
                const langMatch = line.match(/tvg-language="([^"]+)"/);

                const nameParts = line.split(',');
                const name = nameParts.length > 1 ? nameParts[nameParts.length - 1].trim() : 'Unknown Channel';

                const internalId = idMatch ? idMatch[1] : Math.random().toString(36).substring(7);
                const inferredLang = langMatch ? langMatch[1] : detectLanguage(idMatch ? idMatch[1] : '', name, groupMatch ? groupMatch[1] : '');

                currentChannel = {
                    id: internalId,
                    name: name,
                    logo: logoMatch ? logoMatch[1] : 'https://via.placeholder.com/150?text=TV',
                    category: groupMatch ? groupMatch[1] : 'Uncategorized',
                    language: inferredLang
                };
            } else if (line.startsWith('#KODIPROP:')) {
                const prop = line.replace('#KODIPROP:', '');
                const [key, value] = prop.split('=');
                if (key.includes('license_type')) {
                    if (!currentChannel.drmInfo) currentChannel.drmInfo = {};
                    currentChannel.drmInfo.drmType = value.toLowerCase() as any;
                } else if (key.includes('license_key')) {
                    if (!currentChannel.drmInfo) currentChannel.drmInfo = {};
                    currentChannel.drmInfo.licenseUrl = value;
                }
            } else if (line.startsWith('#EXT-X-SESSION-KEY:')) {
                const uriMatch = line.match(/URI="([^"]+)"/);
                if (uriMatch) {
                    if (!currentChannel.drmInfo) currentChannel.drmInfo = {};
                    currentChannel.drmInfo.licenseUrl = uriMatch[1];
                    if (line.toLowerCase().includes('widevine')) {
                        currentChannel.drmInfo.drmType = 'widevine';
                    }
                }
            } else if (line.startsWith('http')) {
                // Valid stream URL
                if (currentChannel.name) {
                    currentChannel.url = line;
                    channels.push(currentChannel as Channel);
                    currentChannel = {}; // reset for next
                }
            }
        }

        return channels;
    } catch (error) {
        console.error("M3U Parsing Error:", error);
        return [];
    }
}
