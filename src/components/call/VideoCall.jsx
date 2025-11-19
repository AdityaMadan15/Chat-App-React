import React, { useRef, useEffect, useState } from 'react';
import { useSocket } from '../../hooks/useSocket';
import '../../styles/VideoCall.css';

const VideoCall = ({ friend, user, onEndCall, callType, isIncoming = false, peerConnection: incomingPeerConnection, stream: incomingStream }) => {
  const { socket } = useSocket();
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(callType === 'voice');
  const [callStatus, setCallStatus] = useState(isIncoming ? 'Connecting...' : 'Calling...');
  const [callDuration, setCallDuration] = useState(0);
  
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const timerIntervalRef = useRef(null);

  // STUN servers for WebRTC
  const iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' }
    ]
  };

  useEffect(() => {
    if (isIncoming && incomingPeerConnection && incomingStream) {
      // Use peer connection and stream from IncomingCall
      peerConnectionRef.current = incomingPeerConnection;
      setLocalStream(incomingStream);
      
      // Set local video
      if (localVideoRef.current && callType === 'video') {
        localVideoRef.current.srcObject = incomingStream;
      }
      
      // Listen for remote stream
      incomingPeerConnection.ontrack = (event) => {
        console.log('📹 Remote stream received (incoming call)');
        const remote = event.streams[0];
        setRemoteStream(remote);
        
        // Start timer
        if (!timerIntervalRef.current) {
          timerIntervalRef.current = setInterval(() => {
            setCallDuration(prev => prev + 1);
          }, 1000);
        }
        
        if (callType === 'video' && remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remote;
          remoteVideoRef.current.play().catch(e => console.error('Video play error:', e));
        } else if (callType === 'voice' && remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = remote;
          remoteAudioRef.current.play().catch(e => console.error('Audio play error:', e));
        }
        
        setCallStatus('Connected');
      };
      
      // Connection state
      incomingPeerConnection.onconnectionstatechange = () => {
        console.log('Connection state:', incomingPeerConnection.connectionState);
        if (incomingPeerConnection.connectionState === 'connected') {
          setCallStatus('Connected');
        } else if (incomingPeerConnection.connectionState === 'disconnected') {
          setCallStatus('Disconnected');
        } else if (incomingPeerConnection.connectionState === 'failed') {
          setCallStatus('Connection Failed');
          setTimeout(onEndCall, 2000);
        }
      };
      
      setCallStatus('Connected');
    } else if (!isIncoming) {
      initializeCall();
    }

    return () => {
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (!socket) return;

    socket.on('call-answered', handleCallAnswered);
    socket.on('ice-candidate', handleIceCandidate);
    socket.on('call-rejected', handleCallRejected);
    socket.on('call-ended', handleCallEnded);

    return () => {
      socket.off('call-answered', handleCallAnswered);
      socket.off('ice-candidate', handleIceCandidate);
      socket.off('call-rejected', handleCallRejected);
      socket.off('call-ended', handleCallEnded);
    };
  }, [socket]);

  const initializeCall = async () => {
    try {
      console.log('🎥 Initializing call...', callType);
      
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
      setLocalStream(stream);

      if (localVideoRef.current && callType === 'video') {
        localVideoRef.current.srcObject = stream;
      }

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
            to: friend.id
          });
        }
      };

      // Handle remote stream
      peerConnection.ontrack = (event) => {
        console.log('📹 Remote stream received');
        const remote = event.streams[0];
        setRemoteStream(remote);
        
        // Start timer when connected
        if (!timerIntervalRef.current) {
          timerIntervalRef.current = setInterval(() => {
            setCallDuration(prev => prev + 1);
          }, 1000);
        }
        
        if (callType === 'video' && remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remote;
          // Force video to play
          remoteVideoRef.current.play().catch(e => console.error('Video play error:', e));
        } else if (callType === 'voice' && remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = remote;
          // Force audio to play
          remoteAudioRef.current.play().catch(e => console.error('Audio play error:', e));
        }
        
        setCallStatus('Connected');
      };

      // Connection state changes
      peerConnection.onconnectionstatechange = () => {
        console.log('Connection state:', peerConnection.connectionState);
        if (peerConnection.connectionState === 'connected') {
          setCallStatus('Connected');
        } else if (peerConnection.connectionState === 'disconnected') {
          setCallStatus('Disconnected');
        } else if (peerConnection.connectionState === 'failed') {
          setCallStatus('Connection Failed');
          setTimeout(onEndCall, 2000);
        }
      };

      // Create and send offer
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      socket.emit('call-user', {
        offer,
        to: friend.id,
        from: user.id,
        callType,
        callerName: user.username
      });

    } catch (error) {
      console.error('Error initializing call:', error);
      alert('Failed to access camera/microphone. Please check permissions.');
      onEndCall();
    }
  };

  const handleCallAnswered = async ({ answer, fromId }) => {
    try {
      console.log('✅ Call answered by', fromId);
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
      setCallStatus('Connected');
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  };

  const handleIceCandidate = async ({ candidate, fromId }) => {
    try {
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      }
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  };

  const handleCallRejected = () => {
    setCallStatus('Call Declined');
    setTimeout(onEndCall, 2000);
  };

  const handleCallEnded = () => {
    cleanup();
    onEndCall();
  };

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream && callType === 'video') {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  const endCall = () => {
    socket.emit('end-call', { to: friend.id });
    cleanup();
    onEndCall();
  };

  const cleanup = () => {
    // Stop timer
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
  };

  // Format call duration as MM:SS
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="video-call-container">
      <div className="video-call-header">
        <h3>{friend.username}</h3>
        <p className="call-status">
          {callStatus === 'Connected' ? formatDuration(callDuration) : callStatus}
        </p>
      </div>

      <div className="video-streams">
        {callType === 'video' ? (
          <>
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="remote-video"
            />
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="local-video"
            />
          </>
        ) : (
          <>
            <audio ref={remoteAudioRef} autoPlay playsInline />
            <div className="voice-call-display">
              <div className="caller-avatar">
                <div className="avatar-circle">
                  {friend.username[0].toUpperCase()}
                </div>
              </div>
              <h2>{friend.username}</h2>
              <p className="voice-call-status">
                {callStatus === 'Connected' ? formatDuration(callDuration) : callStatus}
              </p>
            </div>
          </>
        )}
      </div>

      <div className="call-controls">
        <button 
          className={`control-btn ${isMuted ? 'active' : ''}`}
          onClick={toggleMute}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? '🔇' : '🎤'}
        </button>

        {callType === 'video' && (
          <button 
            className={`control-btn ${isVideoOff ? 'active' : ''}`}
            onClick={toggleVideo}
            title={isVideoOff ? 'Turn On Camera' : 'Turn Off Camera'}
          >
            {isVideoOff ? '📷❌' : '📹'}
          </button>
        )}

        <button 
          className="control-btn end-call"
          onClick={endCall}
          title="End Call"
        >
          📞
        </button>
      </div>
    </div>
  );
};

export default VideoCall;
