/**
 * @name YtMooPlayer
 * @class Represents a YtMooPlayer.
 * 
 * @example
 * var myplayer = new YtMooPlayer(
 *   'player_div', // use #player_div as container
 *   {
 *     'videoId': 'AJSWEHNCBDE' // load YT-Video with that id
 *   }
 * ); 
 * myplayer.play(); // start the video
 * 
 * @author DracoBlue <a href="mailto:JanS@DracoBlue.de">JanS@DracoBlue.de</a>
 * @version 1.0.1
 */
/**
 * The video has been stopped by the user or ended.
 * @event
 * @name YtMooPlayer#onEnded
 * 
 * @since 1.0
 */
/**
 * The players state has changed.
 * @event
 * @name YtMooPlayer#onStateChange
 * @param {Number} stateId The new state
 * @param {Number} previousStateId The previous state
 * 
 * @since 1.0
 */
/**
 * The player is ready for loading/playing videos now.
 * @event
 * @name YtMooPlayer#onReady
 * 
 * @since 1.0
 */
/**
 * The player has been intialized. Occurs right after the Event {@link onReady}. 
 * @event
 * @name YtMooPlayer#onUnstarted
 * 
 * @since 1.0
 */
/**
 * The video starts to play. 
 * @event
 * @name YtMooPlayer#onPlay
 * 
 * @since 1.0
 */
/**
 * The video has been paused. 
 * @event
 * @name YtMooPlayer#onPaused
 * 
 * @since 1.0
 */
/**
 * The video is buffering. As soon as enough is buffered the Event {@link onPlay}
 * will be triggered and the video starts to play.
 * @event
 * @name YtMooPlayer#onBuffering
 * 
 * @since 1.0
 */
/**
 * The video is currently cueing. This happens usually after the Event {@link onLoading}.
 * As soon as this Event is triggered one may launch the video with the {@link play} Method. 
 * @event
 * @name YtMooPlayer#onCueing
 * 
 * @since 1.0
 */
/**
 * The video is currently loaded. Loading means, that the video is about to be accessible
 * by the player (e.g. reading duration is possible).  
 * @event
 * @name YtMooPlayer#onLoading
 * 
 * @since 1.0
 */
/**
 * The video is completly buffered.  
 * @event
 * @name YtMooPlayer#onBuffered
 * 
 * @since 1.0
 */

var YtMooPlayer = new Class(
	/**
	 * @lends YtMooPlayer.prototype
	 */ {
	
	Implements: [
	    Options,
	    Events
	],

	options:{
		videoId: false,
		autoStart: false,
		width: 640,
		height: 385,
		loading_check_interval: 1000,
		playback_time_check_interval: 1000
	},

	stateId:-3,
	
	/**
	 * @constant
	 */	
	stateIdToTextMap: {
		
		// YtMooPlayer-Extra:
		'-3': 'NotLoaded',
		'-2': 'PlayerLoaded',

		// Default YT-States
		'-1': 'Unstarted',
		 0: 'Ended',
		 1: 'Playing',
		 2: 'Paused',
		 3: 'Buffering',
		 5: 'Cueing'
	},

	/**
	 * @constant
	 */		
	stateIdToEventMap: {
		'-1': 'onUnstarted',
		   0: 'onEnded',
		   1: 'onPlay',
		   2: 'onPaused',
		   3: 'onBuffering',
		   5: 'onCueing'			
	},

	ytplayer: null,

	loadedBytesTimer: false,
	playTimeTimer: false,

	playerPrefix: false,

	/**
	 * Initialize the YtMooPlayer. This will also create an instance of the flashplayer, which
	 * is needed to use the YtMooPlayer!
	 * 
	 * @since 1.0
	 */
	initialize: function(target,options) {
		
		this.setOptions(options);

		if (!target.match(/^[0-9\_a-zA-Z]+$/)) {
			
			throw 'YtMooPlayer target may contain only 0-9, A-z and _ (under scores).';
		}
		
		/*
		 * There are 2 global variables and one dom-element, which are necessary for
		 * YtMooPlayer to work, thatswhy we have this prefix.
		 */
		this.playerPrefix = 'ytmooplayer_PRIVATE_'+target+'_'; 

		/*
		 * We'll define a prefixed onStateChange and onError global function, which
		 * the youtubeplayer loosely needs to "send" us messages.
		 */
		window[this.playerPrefix+'onStateChange'] = this.onYoutubeSaysStateChange.bind(this); 
		window[this.playerPrefix+'onError'] = this.onYoutubeSaysError.bind(this);
		
		/*
		 * We'll use that one as closure, in case the onYouTubePlayerReady is already
		 * in use and we have to make our own
		 */
		var previous_onYouTubePlayerReady = window['onYouTubePlayerReady'] || undefined;

		/*
		 * We'll use that in function, which can't access the "real" >this<.
		 */
		var that = this; 

		if (typeof window["onYouTubePlayerReady"] == 'function') {
			/*
			 * In case the onYouTubePlayerReady is already a function, we'll wrap around
			 * that one and add our own!
			 */
			window["onYouTubePlayerReady"] = function (playerId) {
				$try(previous_onYouTubePlayerReady(playerId));
				that.onYoutubeSaysPlayerReady(playerId);
			}
		} else {
			/*
			 * If onYouTubePlayerReady is not yet defined as function, so we can define it!
			 */
			window["onYouTubePlayerReady"] = this.onYoutubeSaysPlayerReady.bind(this);
		}

		var flashvars = {
			allowScriptAccess: "always",
			bgcolor: "#cccccc"
		}

		flashvars.wMode='transparent';

		this.ytplayer = new Swiff('http://www.youtube.com/apiplayer?enablejsapi=1&version=3&playerapiid='+this.playerPrefix+'player', {
			
			id        : this.playerPrefix+'player',
			width     : this.options.width,
			height    : this.options.height,
			container : $(target),
			params    : flashvars
		
		});
	},

	/**
	 * Will be called from youtube-engine to tell us a youtube player is ready.
	 * We'll need to check if this is really the youtube player we created with
	 * this instance of YtMooPlayer, by confirming the given playerId
	 * 
	 * @private
	 * @since 1.0
	 */
	 onYoutubeSaysPlayerReady: function(playerId) {
		if (this.playerPrefix+'player' == playerId) {
			/*
			 * If the state is still the YtMooPlayer internal "not loaded"-state (-3)
			 * we'll set it to YtMooPlayer internal "player loaded"-state -2 
			 */
			if (this.stateId === -3)
			{
				this.stateId = -2;
				this.fireEvent('onStateChange',[-2, -3]);
			}

			/*
			 * Register ourselfs for the prefixed YtMooPlayer globals which youtube talks to.
			 */
			this.ytplayer.remote('addEventListener','onStateChange', this.playerPrefix+'onStateChange');
			this.ytplayer.remote('addEventListener','onError', this.playerPrefix+'onError');
			
			var playerStateId = this.ytplayer.remote('getPlayerState').toInt();
			if (playerStateId !== this.stateId)
			{
				var previousStateId = this.stateId;
				this.stateId = playerStateId;
				if (playerStateId == -1) {
					this.fireEvent('onUnstarted',[-2, -3]);
				}
				this.fireEvent('onStateChange',[playerStateId, previousStateId]);
			}

			/*
			 * If there is a videoId set in the options, let's cue it!
			 */
			if(this.options.videoId){
				this.cue();
			}
			
			this.fireEvent('onReady');
		}
	},
	
	/**
	 * As soon as the YT Player's state changes, this function will be triggered
	 * 
	 * @private
	 * @since 1.0
	 */
	onYoutubeSaysStateChange: function(state){
		var previousStateId = this.stateId;
		this.stateId = state
		
		if(state == 1 && (previousStateId == 0 || previousStateId == -1)) {
			this.fireEvent('onStart');
		}

		if ($defined(this.stateIdToEventMap[state])) this.fireEvent(this.stateIdToEventMap[state]);
		
		if (false === this.loadedBytesTimer) {
			if ((state == 3) && this.getPercentLoaded() != 100) { // buffering and not yet 100%
				this.loadedBytesTimer = (function () {
					var percent = this.getPercentLoaded();

					if (percent == 100) {
						this.fireEvent('onBuffered');
					}
					
					if (percent == 100 || (this.stateId != 1 && this.stateId != 3)) {
						$clear(this.loadedBytesTimer);
						this.loadedBytesTimer = false;
					}
				}).periodical(this.options.loading_check_interval, this);
			} else if (state == 3) {
				this.fireEvent('onBuffered');
			}
		}
		
		if (false !== this.playTimeTimer && state != 1) {
			$clear(this.playTimeTimer);
			this.playTimeTimer = false;
		} else if (false === this.playTimeTimer && state == 1) {
			this.playTimeTimer = (function () {
				percent = this.getCurrentPercent();
			}).periodical(this.options.playback_time_check_interval, this);
		}
		
		this.fireEvent('onStateChange', [state, previousStateId]);
	},

	/**
	 * If the YT Player encounters an error, this funciton will be triggered.
	 * 
	 * @private
	 * @since 1.0
	 */
	onYoutubeSaysError: function(error){
		if (100 == error) {
			this.fireEvent('onNotFound');
		} else if (150 == error || 100 == error) { // quote: The error code 150 is the same as 101, it's just 101 in disguise!
			this.fireEvent('onNotAllowed');
		}

		/*
		 * Ok, if we already have a videoId, let's just cue it again (so it does not look ugly)
		 */
		if (this.options.videoId) {
			this.cue();
		}
		
		this.fireEvent('onError',error);
	},
	

	/**
	 * Get the current state of the player as text.
	 * 
	 * @return {String}
	 * @since 1.0
	 */
	getState: function() {
		return this.stateIdToTextMap[this.stateId];
	},

	/**
	 * Get the current state of the player as number.
	 * 
	 * @return {Number} sss
	 * @since 1.0
	 */
	getStateId: function() {
		return this.stateId;
	},

	/**
	 * Determine how much percent of the video are already loaded.
	 * 
	 * @since 1.0
	 */
	getPercentLoaded: function() {
		var total = this.getBytesTotal();
		var loaded = this.getBytesLoaded(); 
		if (loaded === 0 || total === 0) return 0;
		if (loaded == total) return 100;
		return (100*loaded / total).ceil();
	},

	/**
	 * Determines the amount of bytes, which are already loaded.
	 * 
	 * @since 1.0
	 */		
	getBytesLoaded: function() {
		var ret_val = this.ytplayer.remote("getVideoBytesLoaded");
		return ret_val != -1 ? ret_val : 0;			
	},

	/**
	 * Determines the videos amount of total bytes.
	 * 
	 * @since 1.0
	 */		
	getBytesTotal: function() {
		var ret_val = this.ytplayer.remote("getVideoBytesTotal");
		return ret_val != -1 ? ret_val : 0;			
	},
	
	getVideoEmbedCode: function() {
		if(this.stateId != -3){
			ret_val = this.ytplayer.remote('getVideoEmbedCode');
			return ret_val != '' ? ret_val : false;				
		}
		return false;
	},

	/**
	 * Get the duration of the video in seconds.
	 * 
	 * @since 1.0
	 */
	getDuration:function(){
		if(this.stateId != -3){
			var ret_val = this.ytplayer.remote('getDuration');
			return ret_val != -1 ? ret_val : false;				
		}
		return false;
	},
		
	/**
	 * Get the seconds of video playback passed.
	 * 
	 * @since 1.0
	 */
	 getCurrentTime: function(){
		if(this.stateId != -3){
			var ret_val = this.ytplayer.remote('getCurrentTime');
			return ret_val != -1 ? ret_val : false;				
		}
		return false;
	},	
		

	/**
	 * Get the percent of time passed, for the video playback.
	 * 
	 * @since 1.0
	 */
	getCurrentPercent:function(){
		var total = this.getDuration();
		var current = this.getCurrentTime(); 
		if (current === 0 || total === 0) return 0;
		if (current == total) return 100;
		return (100*current / total).ceil();
	},
	
	/**
	 * Play a specific video. Takes an optional parameter to determine the second to start from.
	 * 
	 * @since 1.0
	 */
	playVideo: function(videoId, startSeconds)
	{
		this.options.videoId = videoId;
		if(this.stateId != -3){
			this.fireEvent('onLoading');
			this.ytplayer.remote('loadVideoById', this.options.videoId, startSeconds);
		}
	},
	
	/**
	 * Load a video
	 */
	loadVideo: function(videoId, startSeconds)
	{
		this.options.videoId = videoId;
		if(this.stateId != -3){
			this.fireEvent('onLoading');
			this.ytplayer.remote('cueVideoById', this.options.videoId, startSeconds);
		}
	},

	/**
	 * Play the current video. Takes an optional parameter to determine the second to start from.
	 * 
	 * @since 1.0
	 */
	play:function(startSeconds){
		if(this.stateId != -3){
			if([2,3,5].contains(this.stateId)){
				this.ytplayer.remote('playVideo');
			} else if (this.options.videoId && 0 == this.stateId) {
				this.fireEvent('onLoading');
				this.ytplayer.remote('loadVideoById', this.options.videoId, startSeconds);
			}
		}
	},

	/**
	 * Cue a video. Takes an optional parameter to determine the second to start from.
	 * 
	 * @since 1.0
	 */
	cue:function(startSeconds){
		if(this.stateId != -3){
			this.ytplayer.remote('cueVideoById', this.options.videoId, startSeconds);
		}
	},

	/**
	 * Pause the video.
	 * 
	 * @since 1.0
	 */
	pause: function(){
		if(this.stateId == 1 || this.stateId == 3){
			this.ytplayer.remote('pauseVideo');
		}
	},

	/**
	 * Stop the video.
	 * 
	 * @since 1.0
	 */
	stop: function(){
		if(this.stateId != -3){
			this.ytplayer.remote('stopVideo');
		}
	}		
	
});


/**
 * The YtMooDebugPlayer is the debug version of the YtMooPlayer.
 * 
 * It extends the YtMooPlayer and has two extra options.
 * 1. {String} debugKey
 * 2. {Array} debugEvents Array of Eventnames
 * 
 * As soon as one of the debugEvents get's triggered, a
 * console.log(debugKey,arguments) will be called.
 * So this class is nice for debugging YtMooPlayer.
 * @name YtMooDebugPlayer
 * @class Represents a YtMooDebugPlayer. 
 * @extends YtMooPlayer
 * 
 * @example
 * var myplayer = new YtMooDebugPlayer(
 *   'player_div', // use #player_div as container
 *   {
 *     'videoId': 'AJSWEHNCBDE' // load YT-Video with that id
 *     'debugKey': 'MyLittleDBGPlayer'
 *   }
 * ); 
 * myplayer.play(); // start the video
 * // This will result in console-Messages in FireBug
 * //   MyLittleDBGPlayer: ['onPlay']
 * //   ...
 * //   MyLittleDBGPlayer: ['onEnded']
 * 
 * @author DracoBlue <a href="mailto:JanS@DracoBlue.de">JanS@DracoBlue.de</a>
 * @version 1.0
 */
var YtMooDebugPlayer = new Class(
		/**
		 * @lends YtMooDebugPlayer.prototype
		 */ {
		
		Implements: [
		    Options,
		    Events
		],
		
		options: {
			 debugEvents:[
			     'onStateChange',
			     'onReady', 'onStart', 'onPlay', 'onNotFound',
			     'onNotAllowed', 'onError', 'onBuffered', 'onBuffering', 'onLoading',
			     'onCueing', 'onUnstarted', 'onPaused', 'onEnded'
			 ],
			 debugKey:'YtMooDebugPlayer'
		},
		
		Extends: YtMooPlayer,
		
		initialize: function(target,options) {
			 this.parent(target, options);
			 
			 var that = this;
			 $each(this.options.debugEvents,function(event_name) {
				 if (typeof that[event_name] === 'undefined') {
					 throw 'No handler '+event_name+'() defined for debugEvent '+event_name;
				 } else {
					 that.addEvent(event_name,that[event_name].bind(that));
				 }
			 });
		 },
		
		log: function() {
			 console.log(this.options.debugKey,$A(arguments));
		},
		
		onStateChange : function(new_state, old_state)
		{
			this.log('onStateChange',new_state,old_state);
		},
		onReady : function()
		{
			this.log('onReady');
		},
		onStart : function()
		{
			this.log('onStart');
		},
		onPlay : function()
		{
			this.log('onPlay');
		},
		onPaused : function()
		{
			this.log('onPaused');
		},
		onNotFound : function()
		{
			this.log('onNotFound');
		},
		onNotAllowed : function()
		{
			this.log('onNotAllowed');
		},
		onError : function(errorId)
		{
			this.log('onError',errorId);
		},
		onBuffered : function()
		{
			this.log('onBuffered');
		},
		onBuffering : function()
		{
			this.log('onBuffering');
		},
		onLoading : function()
		{
			this.log('onLoading');
		},
		onUnstarted : function()
		{
			this.log('onUnstarted');
		},
		onCueing : function()
		{
			this.log('onCueing');
		},
		onEnded : function()
		{
			this.log('onEnded');
		}
});		
