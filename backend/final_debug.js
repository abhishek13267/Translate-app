const https = require('https');

const translateWithMyMemory = (text, sourceLang, targetLang) => {
    return new Promise((resolve) => {
        const source = (!sourceLang || sourceLang === 'auto') ? 'en' : sourceLang.split('-')[0];
        const target = targetLang.split('-')[0];
        const query = encodeURIComponent(text);
        
        const langpair = encodeURIComponent(`${source}|${target}`);
        const url = `https://api.mymemory.translated.net/get?q=${query}&langpair=${langpair}`;
        
        console.log(`[TESTING] Fetching: "${text}" from ${source} to ${target}`);

        const options = {
            timeout: 10000,
            headers: {
                'User-Agent': 'VaakAI/2.0 (Premium Studio; contact@vaakai.dev)'
            }
        };

        const req = https.get(url, options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.responseData?.translatedText) {
                        resolve(parsed.responseData.translatedText);
                    } else {
                        resolve(null);
                    }
                } catch (e) {
                    resolve(null);
                }
            });
        }).on('error', (err) => {
            console.error('Network Error:', err.message);
            resolve(err.message);
        });

        req.on('timeout', () => {
             console.error('Timed out!');
             req.destroy();
             resolve('Timeout');
        });
    });
};

translateWithMyMemory("Hello how are you?", "en-US", "hi")
    .then(res => console.log('RESULT:', res))
    .catch(err => console.error(err));
