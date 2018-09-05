
import EventEmitter from 'events';
import ReconnectingWebSocket from 'reconnecting-websocket';


class SignalClient extends EventEmitter{
    constructor(engine, peerId, config) {
        super();
        this.engine = engine;
        this.peerId = peerId;
        this.config = config;
        this.connected = false;
        this.msgQueue = [];
        this._ws = this._init(peerId);
    }

    _init(id) {
        const { logger } = this.engine;
        const wsOptions = {
            maxRetries: this.config.wsMaxRetries,
            minReconnectionDelay: this.config.wsReconnectInterval*1000
        };
        let queryStr = `?id=${id}`;
        let ws = new ReconnectingWebSocket(this.config.wsSignalerAddr+queryStr, undefined, wsOptions);
        ws.onopen = () => {
            logger.info('Signaler websocket connection opened');

            this.connected = true;

            // 发送所有没有成功发送的消息
            if (this.msgQueue.length > 0) {
                logger.warn(`resend all cached msg`);
                this.msgQueue.forEach(msg => {
                    this._ws.send(msg);
                });
                this.msgQueue = [];
            }

            if (this.onopen) this.onopen();
        };

        ws.push = ws.send;
        ws.send = msg => {
            let msgStr = JSON.stringify(Object.assign({peer_id: id}, msg));
            ws.push(msgStr);
        };
        ws.onmessage = (e) => {

            if (this.onmessage) this.onmessage(e)
        };
        ws.onclose = () => {                                            //websocket断开时清除datachannel
            logger.warn(`Signaler websocket closed`);
            if (this.onclose) this.onclose();
            this.connected = false;
        };
        return ws;
    }

    sendSignal(remotePeerId, data) {
        let msg = {
            action: 'signal',
            peer_id: this.peerId,
            to_peer_id: remotePeerId,
            data: data
        };
        this._send(msg);
    }

    _send(msg) {
        const { logger } = this.engine;
        if (this.connected) {
            this._ws.send(msg);
        } else {
            logger.warn(`signaler closed, msg is cached`);
            this.msgQueue.push(msg);
        }

    }

    close() {
        const { logger } = this.engine;
        logger.warn(`close signal client`);
        this.connected = false;
        this._ws.close();
        this._ws = null;
    }
}

export default SignalClient;