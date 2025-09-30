    // src/hooks/useRoomSocket.js
    import { useEffect, useRef } from 'react';
    import { io } from 'socket.io-client';

    let socket = null;

    /*
    useRoomSocket(roomId, onMessage)
    - joins the room and calls onMessage(newMsg) for each incoming message
    - ensure you leave room when roomId changes
    */
    export default function useRoomSocket(roomId, onMessage) {
    const roomRef = useRef(roomId);

    useEffect(() => {
        if (!roomId) return;

        // create shared socket instance once
        if (!socket) {
        const url = import.meta.env.VITE_SOCKET_SERVER_URL || 'http://localhost:7000'; // optional override, otherwise same origin
        socket = io(url || undefined, {
            transports: ['websocket']
        });
        }

        const roomName = roomId;
        // join the server room; server expects 'join' with { room }
        socket.emit('join', { room: roomName });

        const handler = (msg) => {
        onMessage && onMessage(msg);
        };

        socket.on('message', handler);

        // optionally handle join ack / errors
        socket.on('joined', (data) => {
        // console.log('joined', data);
        });

        return () => {
        try {
            socket.off('message', handler);
            socket.emit('leave', { room: roomName });
        } catch (e) {}
        };
    }, [roomId, onMessage]);
    }
