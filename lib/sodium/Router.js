import { Dictionary, Set } from 'lib/typescript-collections.js';
import { StreamWithSend } from 'lib/sodium/Stream.js';
import { Vertex, Source } from 'lib/sodium/Vertex.js';
/* eslint-disable prefer-const */
export class Router {
    _inStream;
    _table;
    _vertex;
    constructor(inStream, selector, keyToStr) {
        this._inStream = inStream;
        this._table = new Dictionary(keyToStr);
        this._vertex = new Vertex('Router', this._inStream.getVertex__().rank + 1, // <-- estimated rank only, may be adjusted by ensureBiggerThan
        []);
        this._vertex.addSource(new Source(this._inStream.getVertex__(), () => this._inStream.listen_(this._vertex, (a) => {
            let ks = selector(a);
            let visited = new Set(keyToStr);
            let outs = [];
            for (let i = 0; i < ks.length; ++i) {
                let k = ks[i];
                if (visited.contains(k)) {
                    continue;
                }
                visited.add(k);
                let outs2 = this._table.getValue(k);
                if (outs2 != undefined) {
                    for (let j = 0; j < outs2.length; ++j) {
                        outs.push(outs2[j]);
                    }
                }
            }
            for (let i = 0; i < outs.length; ++i) {
                outs[i].send_(a);
            }
        }, true)));
    }
    filterMatches(k) {
        let out = new StreamWithSend();
        let vertex = new Vertex('Router::filterMatches', this._vertex.rank + 1, // <-- estimated rank only, may be adjusted by ensureBiggerThan
        [
            new Source(this._vertex, () => {
                this._vertex.increment(out.getVertex__());
                let outs = this._table.getValue(k);
                if (outs == undefined) {
                    outs = [];
                    this._table.setValue(k, outs);
                }
                outs.push(out);
                return () => {
                    this._vertex.decrement(out.getVertex__());
                    // This is definitely not undefined because it was set above
                    let outs2 = this._table.getValue(k);
                    for (let i = outs2.length - 1; i >= 0; --i) {
                        if (outs2[i] == out) {
                            outs2.splice(i, 1);
                            break;
                        }
                    }
                    if (outs2.length == 0) {
                        this._table.remove(k);
                    }
                };
            }),
        ]);
        out.setVertex__(vertex);
        return out;
    }
}
