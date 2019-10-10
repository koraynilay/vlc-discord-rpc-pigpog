/**
 * This is the main module to be executed. It combines the functions from rpc & vlc.ts to allow
 * the user to update their presence based on the status of their VLC media player. It uses the
 * mini HTTP server that VLC hosts has an interface (interface-name: web). For more info about
 * VideoLan's HTTP server for VLC see the following link. Not everything is documented, all
 * documentation is in the VLC git repository.
 * @link https://wiki.videolan.org/VLC_HTTP_requests/
 *
 * @author Dylan Hackworth <https://github.com/dylhack>
 * @author Jared Toomey <https://github.com/pigpog>
 */
import * as fs                      from 'fs';
import { update }                   from './rpc';
import { getPassword, handleError } from './vlc';

const config = require(`${__dirname}/../config/config.json`);

function setup(): string | undefined {
    let stringifed: string;
    let password: string | undefined;

    password = getPassword();
    if (password) {
        config.vlc.password = password;
        stringifed = JSON.stringify(config);
        fs.writeFileSync(`${__dirname}/../config/config.json`, stringifed);
    }
    return password;
}

function main() {
    let first: boolean;
    setInterval(() => {
        update()
            .then(() => {
                if (!first) {
                    first = true;
                    console.log('Ready. Enjoy!');
                }
            })
            .catch(handleError);
    }, config.rpc.updateInterval);
}

main();
