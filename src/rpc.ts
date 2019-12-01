/**
 * @description The RPC module handles formatting the VLCStatus and updating it
 * to the user's discord presence.
 *
 * @author Dylan Hackworth <https://github.com/dylhack>
 * @author Jared Toomey <https://github.com/pigpog>
 * @LICENSE
 * MIT License
 *
 * Copyright (c) 2019 Jared Toomey
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import * as RPC from 'discord-rpc';
import {Presence} from 'discord-rpc';
import {Meta, VLCStatus} from 'vlc.js/lib/src/http/classes/VLCStatus';
import {getDifference} from './vlc';

const config = require(`${__dirname}/../config/config.json`);
const client = new RPC.Client({transport: 'ipc'});
const char_limit = 128;
const volumePercent = 2.56;
let awake = true;
let timeInactive: number;
let ready: boolean;

export async function update() {
    let formatted: Presence;
    if (!ready) {
        await client.login({clientId: config.rpc.id});
        ready = true;
    }
    getDifference(async (status, difference) => {
        if (difference) {
            formatted = format(status);
            await client.setActivity(formatted);
            if (!awake) {
                awake = true;
                timeInactive = 0;
                console.log(`Update detected, waking up.`);
            }
        } else if (awake) {
            if (status.state !== 'playing') {
                timeInactive += config.rpc.updateInterval;
                if (timeInactive >= config.rpc.sleepTime
                    || status.state === 'stopped') {
                    awake = false;
                    await client.clearActivity();
                    console.log(
                        `Nothing has happened, going to sleep. ` +
                        `(sleep time: ${config.rpc.sleepTime}ms)`,
                    );
                }
            }
        }
    })
}

/**
 * @function format
 * @param {VLCStatus} status
 * @returns {Presence}
 * @description This function formats the VLCStatus into a Presence object.
 * NOTE: Any property in the meta data object of VLCStatus can be undefined,
 * the one property that will almost always be defined is filename.
 *
 * TL;DR: Meta data is never consistent.
 */
function format(status: VLCStatus): Presence {
    let meta: any & Meta;
    let output: Presence = {
        smallImageKey: status.state,
        smallImageText: `Volume: ${Math.round(status.volume / volumePercent)}%`,
    };

    // if playback is stopped
    if (status.state === 'stopped') {
        output = {
            ...output,
            state: 'stopped',
            details: 'Nothing is playing.',
            instance: true,
        };
    } else {
        output.endTimestamp = getEndTimestamp(status);

        if (status.information) {
            meta = status.information.category.meta;
            // If a video...
            if (status.stats && status.stats.decodedvideo > 0) {
                output = {
                    ...output,
                    ...getVideoDetails(meta),
                };
            } else {
                output = {
                    ...output,
                    largeImageKey: 'vlc',
                    ...getSongDetails(meta),
                };
            }
        }
    }
    return lengthCheck(output);
}

/**
 * @function getEndTimestamp
 * @param {VLCStatus} status
 * @returns {number}
 * @description This gets the end timestamp and returns it as a unix timestamp.
 */
function getEndTimestamp(status: VLCStatus): number {
    let now = Date.now();
    let round = 1000;
    return Math.floor(
        (now / round + (status.length - status.time)) / status.rate,
    );
}

/**
 * @function getVideoDetails
 * @param {Meta} meta
 * @returns {Presence}
 * @description This function formats the VLCStatus as a video. If the user is
 * playing media which has a video this function should be used.
 */
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

/**
 * @function getSongDetails
 * @param {Meta} meta
 * @returns {Presence}
 * @description This function formats the VLCStatus as a song. If the user is
 * listening to audio-only media this function should be used.
 */
function getSongDetails(meta: Meta | any): Presence {
    let output: Presence = {};

    // If both essential metadata properties exist
    if (meta.artist && meta.title) {
        output.state = `${meta.artist} - ${meta.title}`;

        // If only the title is provided (usually includes artist)
    } else if (meta.title) {
        output.state = meta.title;

        // If the user listening to audio via a stream
    } else if (meta.now_playing) {
        output.state = meta.now_playing;

        // Finally if none of it exists rely on the filename.
    } else {
        output.state = meta.filename;
    }

    return output;
}

/**
 * @function lengthCheck
 * @param {Presence} presence
 * @returns {Presence}
 * @description This function intakes a Presence object to check that all
 * property character lengths are less than 128 (this is the max for Discord's
 * RPC handler).
 */
function lengthCheck(presence: Presence): Presence {
    let output = presence;

    // A bit of sanity checking
    if (output.details && output.details.length > char_limit) {
        output.details = patchLength(output.details);
    }
    if (output.state && output.state.length > char_limit) {
        output.state = patchLength(output.state);
    }
    if (output.smallImageText && output.smallImageText.length > char_limit) {
        output.smallImageText = patchLength(output.smallImageText);
    }
    if (output.largeImageText && output.largeImageText.length > char_limit) {
        output.largeImageText = patchLength(output.largeImageText);
    }

    return output;
}

/**
 * @function patchLength
 * @param {string} str
 * @returns {string}
 * @description If the provided string is longer than the character limit it
 * will use the substring method to get the beginning to the limit and then
 * replace three end characters with dots.
 */
function patchLength(str: string): string {
    let output = str;

    if (str.length > char_limit) {
        output = str.substr(0, char_limit - 3);
    }
    output += '...';

    return output;
}
