/**
 * This is the main module to be executed. It combines the functions from rpc &
 * vlc.ts to allow the user to update their presence based on the status of
 * their VLC media player. It uses the mini HTTP server that VLC hosts has an
 * interface (interface-name: web). For more info about VideoLan's HTTP server
 * for VLC see the following link. Not everything is documented, all
 * documentation is in the VLC git repository.
 * @link https://wiki.videolan.org/VLC_HTTP_requests/
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
import {update} from './rpc';
import {handleError} from './vlc';

const config = require(`${__dirname}/../config/config.json`);

function main() {
    let first: boolean;
    setInterval(() => {
        update().then(() => {
            if (!first) {
                first = true;
                console.log('Ready. Enjoy!');
            }
        }).catch(handleError);
    }, config.rpc.updateInterval);
}

main();
