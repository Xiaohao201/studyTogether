/**
 * WebRTC Manager for handling peer-to-peer audio/video connections.
 *
 * Manages RTCPeerConnection, local/remote streams, and WebRTC signaling.
 */

export interface WebRTCConfig {
  iceServers?: RTCIceServer[]
  iceTransportPolicy?: 'all' | 'relay'
}

export interface StreamConstraints {
  audio: boolean
  video: boolean | { width?: number; height?: number; facingMode?: string }
}

export class WebRTCManager {
  private peerConnection: RTCPeerConnection | null = null
  private localStream: MediaStream | null = null
  private remoteStream: MediaStream | null = null
  private dataChannel: RTCDataChannel | null = null
  private pendingIceCandidates: RTCIceCandidateInit[] = []

  private config: WebRTCConfig
  private onIceCandidate?: (candidate: RTCIceCandidateInit) => void
  private onTrack?: (event: RTCTrackEvent) => void
  private onDataChannelMessage?: (data: string) => void

  constructor(config?: WebRTCConfig) {
    this.config = config || {
      iceServers: this.getDefaultIceServers(),
    }
  }

  private getDefaultIceServers(): RTCIceServer[] {
    // Default STUN servers
    const servers: RTCIceServer[] = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ]

    // Add TURN server if configured
    if (process.env.NEXT_PUBLIC_TURN_SERVER_URL) {
      servers.push({
        urls: process.env.NEXT_PUBLIC_TURN_SERVER_URL,
        username: process.env.NEXT_PUBLIC_TURN_USERNAME || '',
        credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL || '',
      })
    }

    return servers
  }

  /**
   * Initialize local media stream (camera/microphone).
   */
  async initLocalStream(
    constraints: StreamConstraints = { audio: true, video: true }
  ): Promise<MediaStream> {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints)
      return this.localStream
    } catch (error) {
      console.error('[WebRTC] Error accessing media devices:', error)
      throw new Error('Failed to access camera/microphone. Please grant permissions.')
    }
  }

  /**
   * Create a new RTCPeerConnection.
   */
  createPeerConnection(): RTCPeerConnection {
    if (this.peerConnection) {
      console.warn('[WebRTC] Peer connection already exists')
      return this.peerConnection
    }

    this.peerConnection = new RTCPeerConnection(this.config)

    // ICE candidate handling
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.onIceCandidate) {
        this.onIceCandidate(event.candidate.toJSON())
      }
    }

    // Remote track handling (audio/video)
    this.peerConnection.ontrack = (event) => {
      if (this.onTrack) {
        this.onTrack(event)
      }

      // Add remote tracks to remote stream
      if (!this.remoteStream) {
        this.remoteStream = new MediaStream()
      }
      event.streams[0].getTracks().forEach((track) => {
        this.remoteStream!.addTrack(track)
      })
    }

    // Connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      console.log('[WebRTC] Connection state:', this.peerConnection?.connectionState)
    }

    // ICE connection state changes
    this.peerConnection.oniceconnectionstatechange = () => {
      console.log(
        '[WebRTC] ICE connection state:',
        this.peerConnection?.iceConnectionState
      )
    }

    return this.peerConnection
  }

  /**
   * Add local stream tracks to peer connection.
   */
  addLocalTracks(): void {
    if (!this.peerConnection || !this.localStream) {
      console.warn('[WebRTC] Cannot add tracks: peer connection or local stream not ready')
      return
    }

    this.localStream.getTracks().forEach((track) => {
      this.peerConnection!.addTrack(track, this.localStream!)
    })
  }

  /**
   * Create an offer (for call initiator).
   */
  async createOffer(): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized')
    }

    const offer = await this.peerConnection.createOffer()
    await this.peerConnection.setLocalDescription(offer)
    return offer
  }

  /**
   * Create an answer (for call receiver).
   */
  async createAnswer(): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized')
    }

    const answer = await this.peerConnection.createAnswer()
    await this.peerConnection.setLocalDescription(answer)
    return answer
  }

  /**
   * Set remote description (offer or answer).
   * Flushes any buffered ICE candidates after setting.
   */
  async setRemoteDescription(desc: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized')
    }

    const description = new RTCSessionDescription(desc)
    await this.peerConnection.setRemoteDescription(description)

    // Flush any ICE candidates that arrived before remote description
    for (const candidate of this.pendingIceCandidates) {
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
      } catch {
        // Individual candidate failures are non-fatal
      }
    }
    this.pendingIceCandidates = []
  }

  /**
   * Add ICE candidate for NAT traversal.
   * Buffers candidates if remote description is not yet set.
   */
  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.peerConnection) {
      return
    }

    if (!this.peerConnection.remoteDescription) {
      // Buffer for later — will be flushed after setRemoteDescription
      this.pendingIceCandidates.push(candidate)
      return
    }

    try {
      const iceCandidate = new RTCIceCandidate(candidate)
      await this.peerConnection.addIceCandidate(iceCandidate)
    } catch {
      // Individual candidate failures are non-fatal
    }
  }

  /**
   * Toggle audio track (mute/unmute).
   */
  toggleAudio(enabled: boolean): void {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = enabled
      })
    }
  }

  /**
   * Toggle video track (enable/disable).
   */
  toggleVideo(enabled: boolean): void {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((track) => {
        track.enabled = enabled
      })
    }
  }

  /**
   * Get current audio state.
   */
  isAudioEnabled(): boolean {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0]
      return audioTrack?.enabled ?? false
    }
    return false
  }

  /**
   * Get current video state.
   */
  isVideoEnabled(): boolean {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0]
      return videoTrack?.enabled ?? false
    }
    return false
  }

  /**
   * Create data channel for additional communication.
   */
  createDataChannel(label: string, options?: RTCDataChannelInit): RTCDataChannel {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized')
    }

    this.dataChannel = this.peerConnection.createDataChannel(label, options)

    this.dataChannel.onmessage = (event) => {
      if (this.onDataChannelMessage) {
        this.onDataChannelMessage(event.data)
      }
    }

    return this.dataChannel
  }

  /**
   * Send data via data channel.
   */
  sendDataChannel(data: string): void {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(data)
    }
  }

  /**
   * Get local stream.
   */
  getLocalStream(): MediaStream | null {
    return this.localStream
  }

  /**
   * Get remote stream.
   */
  getRemoteStream(): MediaStream | null {
    return this.remoteStream
  }

  /**
   * Set ICE candidate callback.
   */
  onIceCandidateCallback(callback: (candidate: RTCIceCandidateInit) => void): void {
    this.onIceCandidate = callback
  }

  /**
   * Set track callback.
   */
  onTrackCallback(callback: (event: RTCTrackEvent) => void): void {
    this.onTrack = callback
  }

  /**
   * Set data channel message callback.
   */
  onDataChannelMessageCallback(callback: (data: string) => void): void {
    this.onDataChannelMessage = callback
  }

  /**
   * Clean up resources.
   */
  close(): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop())
      this.localStream = null
    }

    if (this.peerConnection) {
      this.peerConnection.close()
      this.peerConnection = null
    }

    if (this.dataChannel) {
      this.dataChannel.close()
      this.dataChannel = null
    }

    this.remoteStream = null
    this.pendingIceCandidates = []
  }

  /**
   * Check if peer connection is ready.
   */
  isReady(): boolean {
    return (
      this.peerConnection !== null &&
      this.peerConnection.connectionState === 'connected'
    )
  }

  /**
   * Get connection statistics.
   */
  async getStats(): Promise<RTCStatsReport | null> {
    if (!this.peerConnection) {
      return null
    }
    return await this.peerConnection.getStats()
  }
}
