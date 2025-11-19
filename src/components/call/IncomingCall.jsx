import React, { useRef, useState } from 'react';
import { useSocket } from '../../hooks/useSocket';
import '../../styles/IncomingCall.css';

const IncomingCall = ({ caller, offer, callType, user, onAccept, onReject }) => {
  const { socket } = useSocket();
  const [accepting, setAccepting] = useState(false);
  const peerConnectionRef = useRef(null);

  const iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' }
    ]
  };

  const handleAccept = async () => {
    setAccepting(true);
    
    try {
      console.log('📞 Accepting call from', caller.username);
      
      // Get user media
      const constraints = {
        audio: true,
        video: callType === 'video' ? { 
          width: { ideal: 1280 }, 
          height: { ideal: 720 },
          facingMode: 'user'
        } : false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      // Create peer connection
      const peerConnection = new RTCPeerConnection(iceServers);
      peerConnectionRef.current = peerConnection;

      // Add local stream tracks
      stream.getTracks().forEach(track => {
        peerConnection.addTrack(track, stream);
      });

      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('ice-candidate', {
            candidate: event.candidate,
            to: caller.id
          });
        }
      };

      // Set remote description from offer
      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

      // Create answer
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      // Send answer
      socket.emit('answer-call', {
        answer,
        to: caller.id,
        from: user.id
      });

      console.log('✅ Call accepted, answer sent');

      // Pass call acceptance to parent
      onAccept(caller, peerConnection, stream);

    } catch (error) {
      console.error('Error accepting call:', error);
      alert('Failed to access camera/microphone. Please check permissions.');
      handleReject();
    }
  };

  const handleReject = () => {
    console.log('❌ Call rejected');
    socket.emit('reject-call', { to: caller.id });
    onReject();
  };

  return (
    <div className="incoming-call-overlay">
      <div className="incoming-call-modal">
        <div className="caller-info">
          <div className="caller-avatar">
            {caller.username[0].toUpperCase()}
          </div>
          <h2>{caller.username}</h2>
          <p className="call-type-text">
            {callType === 'video' ? '📹 Incoming Video Call' : '📞 Incoming Voice Call'}
          </p>
        </div>

        <div className="call-actions">
          <button 
            className="accept-btn" 
            onClick={handleAccept}
            disabled={accepting}
          >
            {accepting ? '⏳' : '✓'} {accepting ? 'Connecting...' : 'Accept'}
          </button>
          <button 
            className="reject-btn" 
            onClick={handleReject}
            disabled={accepting}
          >
            ✕ Decline
          </button>
        </div>
      </div>
    </div>
  );
};

export default IncomingCall;
