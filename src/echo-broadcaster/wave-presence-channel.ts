import request, { beacon } from '../util/request';

import { PresenceChannel } from 'laravel-echo';

import WavePrivateChannel from './wave-private-channel';
import { authRequest } from '../channel-auth';

export default class WavePresenceChannel extends WavePrivateChannel implements PresenceChannel {
    private joined = false;
    private joinRequest: Promise<Response>;
    private csrfToken: string;
    private users: any[] = [];
    private hereCallbacks: Function[] = [];

    private unloadCallback: () => void = this.unsubscribeBeacon.bind(this);

    constructor(connection, name, options) {
        super(connection, name, options);

        if (typeof window !== 'undefined') {
            window.addEventListener('beforeunload', this.unloadCallback);
        }
    }

    public subscribe(): void {
        super.subscribe();

        this.joinRequest = authRequest(this.name, this.connection, { ...this.options, authEndpoint: this.options.endpoint + '/presence-channel-users' })
            .then(async (response) => {
                const data = await response.json();

                this.csrfToken = data._token;
                this.users = data.users;

                return response;
            }).then((response) => {
                this.joined = true;

                return response;
            }).then((response) => {
                this.hereCallbacks.forEach((callback) => callback(this.users));

                this.hereCallbacks = [];

                return response;
            });

        this.joinRequest.catch(error => {
            this.errorCallbacks.forEach((callback) => callback(error));
        })
    }

    public here(callback: Function): this {
        if (this.joined) {
            request(this.connection)
                .get(this.options.endpoint + '/presence-channel-users', this.options, { channel_name: this.name })
                .then(async (response) => callback(await response.json()))
                .catch((error) => this.errorCallbacks.forEach((callback) => callback(error)));

            return this;
        }

        this.hereCallbacks.push(() => callback(this.users));

        return this;
    }

    /**
     * Register a callback to be called anytime a subscription succeeds.
     * Override to ensure the fluent interface returns the correct subtype.
     */
    public subscribed(callback: (id: string) => void): this {
        this.connection.on('connected', callback);

        return this;
    }

    /**
     * Listen for a whisper event on the channel instance.
     * Override to ensure the fluent interface returns the correct subtype.
     */
    public listenForWhisper(event: string, callback: Function): this {
        super.listenForWhisper(event, callback);

        return this;
    }

    /**
     * Send a whisper event to other clients in the channel.
     * Override to ensure the fluent interface returns the correct subtype.
     */
    public whisper(eventName: string, data: any): this {
        super.whisper(eventName, data);

        return this;
    }

    /**
     * Stop listening for a whisper event on the channel instance.
     * Override to ensure the fluent interface returns the correct subtype.
     */
    public stopListeningForWhisper(event: string, callback?: Function): this {
        super.stopListeningForWhisper(event, callback);

        return this;
    }

    /**
     * Listen for someone joining the channel.
     */
    public joining(callback: Function): this {
        this.listen('.join', callback);

        return this;
    }

    /**
     * Listen for someone leaving the channel.
     */
    public leaving(callback: Function): this {
        this.listen('.leave', callback);

        return this;
    }

    public unsubscribeBeacon(): void {
        beacon(this.connection.getId(), this.csrfToken, this.options.endpoint + '/presence-channel-users', {
            channel_name: this.name,
        }, 'DELETE');

        super.unsubscribe();
    }

    public unsubscribe() {
        this.joinRequest.then(() => {
            request(this.connection, true).delete(this.options.endpoint + '/presence-channel-users', this.options, { channel_name: this.name })
                .then(() => {
                    super.unsubscribe();

                    if (typeof window !== 'undefined') {
                        window.removeEventListener('beforeunload', this.unloadCallback);
                    }
                }).catch((error) => {
                    this.errorCallbacks.forEach((callback) => callback(error));
                });
        });
    }
}
