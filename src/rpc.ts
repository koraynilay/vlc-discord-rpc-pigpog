/**
 * @description The RPC module handles formatting the VLCStatus and updating it to the user's
 * discord presence.
 *
 * @author Dylan Hackworth <https://github.com/dylhack>
 * @author Jared Toomey <https://github.com/pigpog>
 */
import * as RPC            from 'discord-rpc';
import { Presence }        from 'discord-rpc';
import { Meta, VLCStatus } from 'vlc.js/lib/src/http/classes/VLCStatus';
import { getDifference }   from './vlc';

const config = require(`${__dirname}/../config/config.json`);
const client = new RPC.Client({ transport: 'ipc' });
const log = console.log;

let awake = true;
let timeInactive: number;
let ready: boolean;

export async function update() {
    let formatted: Presence;
    if (!ready) {
        await client.login({ clientId: config.rpc.id });
        ready = true;
    }
    await getDifference(async (status, difference) => {
        if (difference) {
            formatted = format(status);
            await client.setActivity(formatted);
            if (!awake) {
                awake = true;
                timeInactive = 0;
                log(`Update detected, waking up.`);
            }
        } else if (awake) {
            if (status.state !== 'playing') {
                timeInactive += config.rpc.updateInterval;
                if (timeInactive >= config.rpc.sleepTime || status.state === 'stopped') {
                    awake = false;
                    await client.clearActivity();
                    log(
                        `Nothing has happened, going to sleep. ` +
                        `(sleep time: ${config.rpc.sleepTime}ms)`
                    );
                }
            }
        }
    })
}

// NOTE: Any property in the meta object of VLCStatus can be undefined, the one property that
// will almost always be defined is filename. Meta data is never consistent some meta data has
// both the author and the song name in the title while others have every property filled out and we
// must work with that.
function format(status: VLCStatus): Presence {
    let meta: any & Meta;
    let output: Presence = {
        smallImageKey: status.state,
        smallImageText: `Volume: ${Math.round(status.volume / 2.56)}%`
    };

    // if playback is stopped
    if (status.state === 'stopped') {
        return {
            ...output,
            state: 'stopped',
            details: 'Nothing is playing.',
            instance: true
        };
    } else {
        output.endTimestamp = getEndTimestamp(status);

        if (status.information) {
            meta = status.information.category.meta;
            // If a video...
            if (status.stats && status.stats.decodedvideo > 0) {
                return {
                    ...output,
                    ...getVideoDetails(meta)
                };
            } else {
                return {
                    ...output,
                    largeImageKey: 'vlc',
                    ...getSongDetails(meta)
                };
            }
        }
        return output;
    }
}

function getEndTimestamp(status: VLCStatus) {
    let now = Date.now();
    let round = 1000;
    return Math.floor(
        (now / round + (status.length - status.time)) / status.rate
    );
}

// TODO: If the YouTube URL is long enough the Discord RPC server will deny the buffer. We
//  should find an alternative.
function getVideoDetails(meta: Meta | any): Presence {
    let output: Presence = {};

    // If it's a youtube video / song
    if (meta.url && meta.url.includes('youtube.com')) {
        output.state = `${meta.title}`;
        output.largeImageKey = 'youtube';
        output.largeImageText = meta.url;
    } else if (meta.showName) {
        // If it's a show
        output.state = `${meta.showName}`;
    } else if (meta.episodeNumber) {
        output.state = `Episode ${meta.episodeNumber}`;
        if (meta.seasonNumber) {
            output.state += ` - Season ${meta.seasonNumber}`;
        }
    } else if (meta.artist && meta.title) {
        output.state = `${meta.artist} - ${meta.title}`;
    } else if (meta.title) {
        output.state = meta.title;
    } else {
        output.state = meta.filename;
    }
    if (output.largeImageKey == undefined) {
        output.largeImageKey = 'vlc';
    }
    return output;
}

function getSongDetails(meta: Meta | any): Presence {
    let output: Presence = {};

    if (meta.artist && meta.title) { // If both essential metadata properties exist
        output.state = `${meta.artist} - ${meta.title}`;
    } else if (meta.title) { // If only the title is provided (usually includes artist)
        output.state = meta.title;
    } else if (meta.now_playing) { // If the user is streaming a song
        output.state = meta.now_playing;
    } else {
        output.state = meta.filename;
    }

    return output;
}
