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
  const iceCandidateQueueRef = useRef([]);
  const hasSetRemoteStreamRef = useRef(false);

  // STUN/TURN servers for WebRTC (including relay for same-network scenarios)
  const iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      // Free TURN servers for better connectivity (especially same WiFi)
      {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      {
        urls: 'turn:openrelay.metered.ca:443?transport=tcp',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      }
    ],
    iceTransportPolicy: 'all', // Use all available candidates (STUN + TURN)
    iceCandidatePoolSize: 10   // Pre-gather candidates for faster connection
  };

  useEffect(() => {
    const setupCall = async () => {
      if (isIncoming && incomingPeerConnection && incomingStream) {
        console.log('🔵 Setting up incoming call');
        peerConnectionRef.current = incomingPeerConnection;
        setLocalStream(incomingStream);
        
        // Set local video immediately
        if (callType === 'video' && localVideoRef.current) {
          localVideoRef.current.srcObject = incomingStream;
          localVideoRef.current.play().catch(e => console.error('Local video play error:', e));
        }
        
        // Start timer immediately
        timerIntervalRef.current = setInterval(() => {
          setCallDuration(prev => prev + 1);
        }, 1000);
        
        // Handle remote tracks - wait for all tracks before setting srcObject
        const receivedTracks = new Set();
        const handleRemoteTrack = (event) => {
          const trackId = event.track.id;
          
          if (receivedTracks.has(trackId)) {
            console.log('⏭️ Skipping duplicate track (incoming):', event.track.kind);
            return;
          }
          receivedTracks.add(trackId);
          
          console.log('📹 Remote track received (incoming):', event.track.kind, '- Total:', receivedTracks.size);
          
          if (!hasSetRemoteStreamRef.current && event.streams && event.streams[0]) {
            const stream = event.streams[0];
            const expectedTracks = callType === 'video' ? 2 : 1;
            
            // Wait for all expected tracks
            if (receivedTracks.size >= expectedTracks) {
              console.log('✅ All tracks received (incoming), setting stream with:', stream.getTracks().map(t => t.kind));
              setRemoteStream(stream);
              hasSetRemoteStreamRef.current = true;
              
              // Small delay to ensure stream is ready
              setTimeout(() => {
                if (callType === 'video' && remoteVideoRef.current) {
                  remoteVideoRef.current.srcObject = stream;
                  remoteVideoRef.current.muted = false;
                  remoteVideoRef.current.volume = 1.0;
                  console.log('✅ Remote video srcObject set (incoming)');
                } else if (callType === 'voice' && remoteAudioRef.current) {
                  remoteAudioRef.current.srcObject = stream;
                  remoteAudioRef.current.muted = false;
                  remoteAudioRef.current.volume = 1.0;
                  console.log('✅ Remote audio srcObject set (incoming)');
                }
                setCallStatus('Connected');
              }, 100);
            }
          }
        };        incomingPeerConnection.ontrack = handleRemoteTrack;
        
        // Check for existing tracks
        const receivers = incomingPeerConnection.getReceivers();
        console.log('🔍 Checking existing receivers:', receivers.length);
        
        if (receivers.length > 0 && receivers[0].track) {
          const stream = new MediaStream();
          receivers.forEach(receiver => {
            if (receiver.track && receiver.track.readyState === 'live') {
              console.log('➕ Adding existing track:', receiver.track.kind);
              stream.addTrack(receiver.track);
            }
          });
          
          if (stream.getTracks().length > 0) {
            console.log('✅ Found existing remote stream with', stream.getTracks().map(t => t.kind));
            setRemoteStream(stream);
            hasSetRemoteStreamRef.current = true;
            
            // Set srcObject
            if (callType === 'video' && remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = stream;
              remoteVideoRef.current.muted = false;
              remoteVideoRef.current.volume = 1.0;
              console.log('✅ Remote video srcObject set (existing)');
            } else if (callType === 'voice' && remoteAudioRef.current) {
              remoteAudioRef.current.srcObject = stream;
              remoteAudioRef.current.muted = false;
              remoteAudioRef.current.volume = 1.0;
              console.log('✅ Remote audio srcObject set (existing)');
            }
            
            setCallStatus('Connected');
          }
        }
        
        // ICE candidates
        incomingPeerConnection.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit('ice-candidate', {
              candidate: event.candidate,
              to: friend.id
            });
          }
        };
        
        incomingPeerConnection.onconnectionstatechange = () => {
          console.log('📡 Connection state:', incomingPeerConnection.connectionState);
          if (incomingPeerConnection.connectionState === 'connected') {
            setCallStatus('Connected');
          } else if (incomingPeerConnection.connectionState === 'failed') {
            setCallStatus('Connection Failed');
            setTimeout(onEndCall, 2000);
          }
        };
        
      } else if (!isIncoming) {
        await initializeCall();
      }
    };
    
    setupCall();

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

      // Handle remote stream - ontrack fires once per track (audio + video = 2 events)
      const receivedTracks = new Set();
      peerConnection.ontrack = (event) => {
        const trackId = event.track.id;
        
        // Avoid processing the same track twice
        if (receivedTracks.has(trackId)) {
          console.log('⏭️ Skipping duplicate track:', event.track.kind);
          return;
        }
        receivedTracks.add(trackId);
        
        console.log('📹 Remote track received:', event.track.kind, '- Total tracks:', receivedTracks.size);
        const remote = event.streams[0];
        
        // For video calls, wait for both audio and video tracks
        // For voice calls, only wait for audio track
        const expectedTracks = callType === 'video' ? 2 : 1;
        
        if (receivedTracks.size >= expectedTracks && !hasSetRemoteStreamRef.current) {
          console.log('✅ All expected tracks received, setting up stream');
          setRemoteStream(remote);
          hasSetRemoteStreamRef.current = true;
          
          // Start timer when connected
          if (!timerIntervalRef.current) {
            timerIntervalRef.current = setInterval(() => {
              setCallDuration(prev => prev + 1);
            }, 1000);
          }
          
          // Small delay to ensure stream is ready
          setTimeout(() => {
            if (callType === 'video' && remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = remote;
              remoteVideoRef.current.muted = false;
              remoteVideoRef.current.volume = 1.0;
              console.log('✅ Remote video srcObject set (outgoing) with', remote.getTracks().length, 'tracks');
            } else if (callType === 'voice' && remoteAudioRef.current) {
              remoteAudioRef.current.srcObject = remote;
              remoteAudioRef.current.muted = false;
              remoteAudioRef.current.volume = 1.0;
              console.log('✅ Remote audio srcObject set (outgoing) with', remote.getTracks().length, 'tracks');
            }
            setCallStatus('Connected');
          }, 100);
        }
      };

      // Connection state changes
      peerConnection.onconnectionstatechange = () => {
        console.log('📡 Connection state:', peerConnection.connectionState);
        if (peerConnection.connectionState === 'connected') {
          setCallStatus('Connected');
        } else if (peerConnection.connectionState === 'disconnected') {
          setCallStatus('Disconnected');
        } else if (peerConnection.connectionState === 'failed') {
          setCallStatus('Connection Failed');
          setTimeout(onEndCall, 2000);
        }
      };

      // ICE connection state
      peerConnection.oniceconnectionstatechange = () => {
        console.log('🧊 ICE connection state:', peerConnection.iceConnectionState);
        if (peerConnection.iceConnectionState === 'connected' || peerConnection.iceConnectionState === 'completed') {
          setCallStatus('Connected');
        }
      };

      // ICE gathering state
      peerConnection.onicegatheringstatechange = () => {
        console.log('🔍 ICE gathering state:', peerConnection.iceGatheringState);
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
      
      // Process queued ICE candidates
      while (iceCandidateQueueRef.current.length > 0) {
        const candidate = iceCandidateQueueRef.current.shift();
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        console.log('✅ Added queued ICE candidate');
      }
      
      setCallStatus('Connected');
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  };

  const handleIceCandidate = async ({ candidate, fromId }) => {
    try {
      if (peerConnectionRef.current && peerConnectionRef.current.remoteDescription) {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        console.log('✅ ICE candidate added');
      } else {
        // Queue the candidate if remote description is not set yet
        console.log('⏳ Queuing ICE candidate (no remote description yet)');
        iceCandidateQueueRef.current.push(candidate);
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
              controls={false}
              muted={false}
              volume={1.0}
              className="remote-video"
              style={{ objectFit: 'cover', width: '100%', height: '100%' }}
              onLoadedMetadata={(e) => {
                console.log('📹 Remote video metadata loaded, tracks:', e.target.srcObject?.getTracks().map(t => t.kind));
                e.target.muted = false;
                e.target.volume = 1.0;
              }}
              onPlay={() => {
                console.log('▶️ Remote video PLAYING');
                if (remoteVideoRef.current) {
                  remoteVideoRef.current.muted = false;
                  remoteVideoRef.current.volume = 1.0;
                }
              }}
              onError={(e) => console.error('❌ Remote video ERROR:', e)}
            />
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              controls={false}
              className="local-video"
              onLoadedMetadata={(e) => {
                console.log('📹 Local video metadata loaded');
              }}
            />
          </>
        ) : (
          <>
            <audio 
              ref={remoteAudioRef} 
              autoPlay 
              playsInline
              muted={false}
              onLoadedMetadata={(e) => {
                console.log('🔊 Remote audio metadata loaded, tracks:', e.target.srcObject?.getTracks().map(t => t.kind));
                e.target.muted = false;
                e.target.volume = 1.0;
              }}
              onPlay={() => {
                console.log('▶️ Remote audio PLAYING');
                if (remoteAudioRef.current) {
                  remoteAudioRef.current.muted = false;
                  remoteAudioRef.current.volume = 1.0;
                }
              }}
              onError={(e) => console.error('❌ Remote audio ERROR:', e)}
            />
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
