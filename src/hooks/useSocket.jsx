import React, { createContext, useContext, useEffect, useState } from 'react';
import io from 'socket.io-client';

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children, user }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');

  useEffect(() => {
    if (!user) return;

    console.log('🔄 Initializing socket connection for user:', user.id, user.username);
    
    const newSocket = io('http://localhost:3001', {
      auth: {
        userId: user.id,
        username: user.username
      },
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      console.log('✅ Connected to backend server as:', user.username);
      setIsConnected(true);
      setConnectionStatus('connected');
      
      // Join user's room for private messaging
      newSocket.emit('join', user.id);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('🔴 Disconnected from server:', reason);
      setIsConnected(false);
      setConnectionStatus('disconnected');
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error);
      setConnectionStatus('error');
    });

    newSocket.on('reconnecting', (attempt) => {
      console.log('🔄 Reconnecting to server... Attempt:', attempt);
      setConnectionStatus('reconnecting');
    });

    newSocket.on('reconnect_failed', () => {
      console.error('❌ Failed to reconnect to server');
      setConnectionStatus('failed');
    });

    // Log all socket events for debugging (optional)
    newSocket.onAny((event, ...args) => {
      if (!event.includes('typing')) { // Reduce noise from typing events
        console.log('📡 Socket event:', event, args);
      }
    });

    setSocket(newSocket);

    return () => {
      console.log('🧹 Cleaning up socket connection for user:', user.username);
      if (newSocket.connected) {
        newSocket.disconnect();
      }
    };
  }, [user]);

  return (
    <SocketContext.Provider value={{ 
      socket, 
      isConnected, 
      connectionStatus 
    }}>
      {children}
    </SocketContext.Provider>
  );
};