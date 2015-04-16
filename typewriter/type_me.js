const bell_width = 69;
			const max_width = 80;
			const tab_width = 8;
			const xpx = 12, ypx = 30, char_height = 20;
			const margin_top = 40, margin_left = 30;
			const max_brokenness = 99;
			const max_ink_level = 600;
			const shifted = {
				'§': '±',
				'1': '!',
				'2': '@',
				'3': '£',
				'4': '$',
				'5': '%',
				'6': '^',
				'7': '&',
				'8': '*',
				'9': '(',
				'0': ')',
				'-': '_',
				'=': '+',
				'[': '{',
				']': '}',
				';': ':',
				'\'': '"',
				'\\': '|',
				',': '<',
				'.': '>',
				'/': '?',
				'`': '~',
			};
			var real_shifted = {};
			var x = max_width * xpx / 2;
			var y = ypx;
			var backspaces = 0;
			var vmid = $(window).height() / 2;
			var hmid = $(window).width() / 2;
			var voffset = {};
			var broken = {};
			var brokenness = 20;
			var ink_remaining = 400;
			var ink_variation = 0.3;
			var keydown_mutex = false;
			var keypress_mutex = false;
			var keydown_keycode = false;
			var shift_mutex = false;
			var alt_mutex = false;
			var capslock_pressed_recently = false;
			var started = false;
			var redshift = false;
			var shift_lock = false;
			var redshift_lock = false;

			function start() {			
				$('.info').hide();
				$('.info-btn, .output, .cursor').show();
				started = true;
			}
			function stop() {
				$('.info-btn, .output, .cursor').hide();
				$('.info').show();
				started = false;
			}
			
			function keydown_capslock(e) {
				// If already locked, unlock
				if (shift_lock || redshift_lock) {
					shift_lock = false;
					redshift_lock = false;
					$.ionSound.play('typewriter-keyup-2');
				}
				// Otherwise, lock whatever is being held
				if (e.shiftKey) {
					shift_lock = true;
				}
				if (redshift) {
					redshift_lock = true;
				}
			}

			function keydown_redshift(e) {	
				e.preventDefault();					
				if (redshift_lock) {
					return false;
				}
				$.ionSound.play('typewriter-spacebar');
				redshift = true;
			}				

			function keydown_shift(e) {
				if (shift_mutex || shift_lock) {
					return false;
				}
				$.ionSound.play('typewriter-spacebar');
				shift_mutex = true;
			} 
			
			function keydown_alt(e) {
				e.preventDefault();
				if (alt_mutex) {
					return false;
				}
				$.ionSound.play('typewriter-spacebar');
				alt_mutex = true;
			}

			function keydown_enter(e) {
				// Although this is a keydown handler, it must also set keypress_mutex to prevent chars being typed during a return
				// as it apparently does not cause a keypress event itself.
				keypress_mutex = true;				
				e.preventDefault();
				// If we're not already at the beginning of the line, start playing the return motion sound
				if (x > 0) {
					$.ionSound.play('typewriter-carriage-return-main');
				}
				$('.output').append('<br/>');
				line_length = x / xpx;
				x = 0;
				backspaces = 0;
				y += ypx;
				return_time = 13 * line_length;
				$('.output').animate({
					top: (vmid - y) + 'px',
				}, 100).animate({
					left: (hmid - x) + 'px',
				}, return_time, function() {
					// When the movement has finished, stop playing the motion sound, play the stop sound, and release the mutexes 
					$.ionSound.stop('typewriter-carriage-return-main');
					$.ionSound.play('typewriter-carriage-return-stop');
					// Do a little wobble
					$('.output').animate({
						left: (hmid - x + 3) + 'px',
						top: (vmid - y + 2) + 'px',
					}, 100).animate({
						left: (hmid - x) + 'px',
						top: (vmid - y) + 'px',
					}, 100);
					keydown_mutex = false;
					keypress_mutex = false;
					keydown_keycode = false;
				}); 
			}
			
			function keydown_cursor_up(e) {
				e.preventDefault();
				if (y > 0) {
					y -= (ypx / 4);
					$.ionSound.play('typewriter-spacebar');
					move_page();
				}
			}

			function keydown_cursor_down(e) {
				e.preventDefault();
				$.ionSound.play('typewriter-spacebar');
				y += (ypx / 4);
				move_page();
			}

			function keydown_cursor_left(e) {
				e.preventDefault();
				if (x > 0) {
					x -= xpx;
					backspaces++;
					$.ionSound.play('typewriter-spacebar');
					move_page();
				} 
			} 

			function keydown_cursor_right(e) {
				e.preventDefault();
				advance_one_space();
				$.ionSound.play('typewriter-spacebar');
				move_page();
			} 
			
			// shared between keydown_cursor_right() and keypress()
			function advance_one_space() {
				if ((x / xpx) < max_width) {
					x += xpx;
				} else {
					backspaces++; // Fudge hard right margin without position:absolute
				}
			}

			function keydown_tab(e) {
				e.preventDefault(); // Don't lose focus
				var oldx = x;
				if (e.shiftKey || shift_lock) {
					var prev_tab_stop = ((x / xpx) % tab_width);
					if (prev_tab_stop == 0) {
						prev_tab_stop = tab_width;
					} 
					if ((x / xpx) - prev_tab_stop < 0) {
						prev_tab_stop = x;
					}
					x -= (prev_tab_stop * xpx); 
					backspaces += prev_tab_stop;
				} else {
					var next_tab_stop = tab_width - ((x / xpx) % tab_width);
					if (next_tab_stop == 0) {
						next_tab_stop = tab_width;
					} else if ((x / xpx) + next_tab_stop > max_width) {
						next_tab_stop = max_width - (x / xpx);
					}
					x += (next_tab_stop * xpx);
				}
				if ((oldx / xpx) < bell_width && (x / xpx) >= bell_width) {
					$.ionSound.play('typewriter-bell-2');
				}	else {				
					$.ionSound.play('typewriter-spacebar');
				}
				move_page();
			}
			
			function keypress(e) {
				// Prevent browser special key actions as long as ctrl/alt/cmd is not being held
				if (! e.altKey && ! e.ctrlKey && ! e.metaKey) {
					e.preventDefault();
					e.stopPropagation();
				}
				// Don't handle keys that are handled by keydown functions
				// These will all have charCode 0, which is the only way of distinguishing them from chars which have the
				// same value on Chrome which sets keyCode to match charCode in keypress handlers. (eg in a keydown handler
				// keyCode 39 is right-arrow, while in a keypress handler, it's the quote character ' )
				if (e.charCode == 0) {
					// Note the use of keyCode here so these numbers will match the keydown ones
					switch (e.keyCode) {
						case 8:
						case 9:
						case 13:
						case 37:
						case 38:
						case 39:
						case 40:
						case 16:
						case 18:
						case 20:
						case 27:
						case 17:
						case 224:
							return false;
					}				
				}
				if (keypress_mutex) {
					return false;
				}
				keypress_mutex = true;
				
				var nosound = false;
				
				var c;
				c = String.fromCharCode(e.charCode); // Always uppercase
				if ( e.charCode >= 65 && e.charCode <= 90 ) {
					// We only want upper case letters if shifted (so caps lock doesn't do them if it's only being used for colourshift lock)
					if (! e.shiftKey && ! shift_lock) {
						c = c.toLowerCase();
					} 
				} else if (e.shiftKey) {
					real_shifted[keydown_keycode] = c; // Learn the real shifted char
					// console.log("Storing " + keydown_keycode + " -> " + c);
    		} else if (shift_lock) {
    			if (keydown_keycode > 0 && real_shifted[keydown_keycode]) {
						// Use the real shifted char if we learned it
    				c = real_shifted[keydown_keycode]; 
						// console.log("Retrieving " + keydown_keycode + " -> " + c);
    			} else if (shifted[c]) {
						// Otherwise fall back to the default shifted char mapping
						// console.log("Using default shiftmap for " + c)
    				c = shifted[c]; 
						// console.log(" -> " + c);
    			}
  		  }

				if (c.match(/\S/)) {
					ink_remaining--;
				}
												
				// Choose a greyscale colour with a random element to simulate uneven key pressure and ribbon ink
				var ink_level = (ink_remaining > 0) ? ink_remaining / 400 - ink_variation + Math.random() * ink_variation : 0;
								
				// Vertical offset
				if (! (c in voffset)) {
					voffset[c] = {
						threshold: Math.floor(Math.random() * 99) + 1, // 1..99
						direction: Math.floor(Math.random() * 3) - 1, // -1..+1
					}						
				}
				
				extra_offset = 0;
				// Extra offset if highly broken
				extra_offset = Math.floor(Math.random() * brokenness / 25); // 0 at b<50, 0..1 at 50<=b<75, 0..2 at b>=75
				if (voffset[c].direction < 0) {
					extra_offset = -extra_offset;
				}
				
				this_voffset = (voffset[c].threshold <= brokenness) ? Math.round(voffset[c].direction * brokenness / 33) : 0;
				this_voffset += extra_offset;
				
				// If brokenness >75%, let some keys be permanently broken.
				// The chance of a key being broken increases with brokenness; once broken, it remains so until brokenness is reduced
				// below 75% whereupon they are all fixed.
				if (brokenness > 75) {
					// Randomly break keys with a likelihood and a maximum number of broken keys that depend on the brokenness level
					if (c != '&nbsp;' && (broken[c] || (Math.random() * brokenness > 70 && Math.random() < 0.4 && Object.keys(broken).length < (brokenness - 75) / 5))) { 
						if (Math.random() > 0.7) {
							broken[c] = '&#9608;'; // full block - as if the embossed character has fallen off the arm.
						} else {
							broken[c] = '&nbsp;'; // as if the key doesn't work at all
							nosound = true;
						}
					}
				} else {
					broken = {};
				}

				// Output the character, unless it's broken
				if (broken[c]) {
					$('.output').append('<div style="position: absolute; top: ' + (y + margin_top) + 'px; left: ' + (x + margin_left) + 'px; color: rgba(0, 0, 0, ' + ink_level + ');">' + broken[c] + '</div>');
				} else {
					var black_height = ypx;
					var black_height_style = '', red_height_style = '';
					// TODO: Make high brokenness do partial red chars sometimes without redshift
					//       The relative probabilities of black and red need to be the opposite of what they are for redshift 
					//       but without reversing the relative positions. voffset also needs to work oppositely.
					//       I think I need to track the position of the print head relative to the ribbon.
					if (redshift || redshift_lock) {
						if (Math.random() < brokenness / 100) {
							// Colour part of the character black, to simulate not pressing Colour Shift hard enough.
							// Black height depends on brokenness level and voffset. As the black creeps in from the top,
							// a char with high negative voffset (shifted upwards) will be more blackened.
							// +ypx-char_height because that is empty space before the top of the visible character.
							black_height = Math.floor(Math.random() * ypx * brokenness / 250) + ypx - char_height - this_voffset;
							if (black_height < 0) {
								black_height = 0; // All red
								red_height_style = '';
							} else {
								black_height_style = 'clip: rect(0px, ' + xpx + 'px, ' + black_height + 'px, 0px); ';
								red_height_style   = 'clip: rect(' + black_height + 'px, ' + xpx + 'px, ' + ypx + 'px, 0px); ';
							}
						} else {
							black_height = 0;
							red_height_style = '';
						}
						// Output the (possibly partial) character in red					
						$('.output').append('<div style="position: absolute; top: ' + (y + this_voffset + margin_top) + 'px; left: ' + (x + margin_left) + 'px; color: rgba(255, 0, 0, ' + ink_level + '); ' + red_height_style + '">' + c + '</div>');
					} 
					if (black_height > 0) {
						// Output the (possibly partial) character in black
						$('.output').append('<div style="position: absolute; top: ' + (y + this_voffset + margin_top) + 'px; left: ' + (x + margin_left) + 'px; color: rgba(0, 0, 0, ' + ink_level + '); ' + black_height_style + '">' + c + '</div>');
						
						// Maybe output further subcropped character(s) in black to make the colouring more uneven
						for (var subclips = 0; subclips < 3; subclips++) {
							var subclip_right = Math.floor(Math.random() * xpx) + 1;
							var subclip_left = Math.floor(Math.random() * subclip_right);
							var subclip_bottom = Math.floor(Math.random() * black_height) + 1;
							var subclip_top = Math.floor(Math.random() * subclip_bottom);
							var r = Math.random();
							var sign = Math.random() < 0.5 ? -1 : 1;
							var b = brokenness / (max_brokenness + 1); // max_brokenness is 99, but let's use a percentage
							var i = ink_remaining / max_ink_level;
							// Thanks to John Valentine for help with the following formula
							var subclip_opacity = i * (0.5 + 0.5 * Math.sqrt(r * b) * sign); 
							var subclip_color = 'color: rgba(0, 0, 0, ' + subclip_opacity + '); ';
							var subclip_clip = 'clip: rect(' + subclip_top + 'px, ' + subclip_right + 'px, ' + subclip_bottom + 'px, ' + subclip_left + 'px); ';
							// console.log("sign: " + sign + " r: " + r + " b:" + b + " i: " + i + " result: " + subclip_opacity);
							$('.output').append('<div style="position: absolute; top: ' + (y + this_voffset + margin_top) + 'px; left: ' + (x + margin_left) + 'px; ' + subclip_color + subclip_clip + '">' + c + '</div>');
						}
					}
				}

				advance_one_space();
				
				if ((x / xpx) == bell_width) {
					$.ionSound.play('typewriter-bell-2');
				} else if (! nosound) {
					// $.ionSound.stop('typewriter-keyup-2');
					$.ionSound.play('typewriter-keydown-2');
				} 

				// Update ink level slider and disp
				$('#ctrl_inklevel').slider('option', 'value', ink_remaining);
				$('#disp_inklevel').html(ink_remaining);
			}

			function keydown_nonmod(e) {
				// Only one non-modifier key may be pressed at a time
				if (keydown_mutex) {
					return false;
				}
				keydown_mutex = true;
				// Because the keypress event does not make keycode available for normal chars, we have to store it in the keydown handler
				// so it can be referenced in the keypress handler to relate shifted chars to their keys so we can retrieve them 
				// when shiftlock is on. 
				keydown_keycode = e.keyCode; 
				switch (e.which) {
					case 9:  // tab
						keydown_tab(e);
						break;
					case 13: // enter
						keydown_enter(e);
						break;
					case 8:  // backspace
					case 37: // left-arrow
						keydown_cursor_left(e);
						break;
					case 38: // up-arrow
						keydown_cursor_up(e);
						break;
					case 32: // space
					case 39: // right-arrow - only needs special handling because Chrome doesn't produce a keypress event for it
						keydown_cursor_right(e);
						break;
					case 40: // down-arrow
						keydown_cursor_down(e);
						break;
					default: // all other characters are handled by the keypress handler
				}
			}
			
			function keydown(e) {	
				if (! started) {
					start();
				}
				switch (e.which) {
					case 16:
						keydown_shift(e);
						break;
					case 18:
						keydown_alt(e);
						break;
					case 20:
						// To cope with Chrome/Mac, FF/Mac, and all Windows&Linux browsers work in 3 different ways wrt caps lock,
						// we have to jump through extra hoops. Start a timer here, and check in keyup.
						capslock_pressed_recently = true;
						setTimeout(function() {
							capslock_pressed_recently = false;
						}, 1500);
						keydown_capslock(e);
						break;
					case 27: // esc
						keydown_redshift(e);
						break;
					case 17:	// ctrl - ignore
					case 224: // cmd - ignore
						break;
					default:
						keydown_nonmod(e);
				}
				return false;
			}
			
			function move_page() {
				$('.output').animate({
					top: (vmid - y) + 'px',
					left: (hmid - x) + 'px',
				}, 20);
			}

			// Handler for keyup events
			function keyup(e) {
				if (e.which == 20) {
					keyup_capslock();
				} else if (shift_mutex && e.which == 16 && ! e.shiftKey) {
					if (! shift_lock) {
						$.ionSound.play('typewriter-keyup-2');
					}
					shift_mutex = false;
				}	else if (alt_mutex && e.which == 18 && ! e.altKey) {
					$.ionSound.play('typewriter-keyup-2');
					alt_mutex = false;
				}	else if (redshift && e.which == 27) {
					if (! redshift_lock) {
						$.ionSound.play('typewriter-keyup-2');
					}
					redshift = false;
				} else if (keydown_mutex && e.which != 13) { // CR does its own sound and mutex release
					// Play the key release sound and release the mutexes after a short delay
					setTimeout(function() {
						$.ionSound.play('typewriter-keyup-2');
						keydown_mutex = false;
						keypress_mutex = false;
						keydown_keycode = false;
					}, 65);
					if (keypress_mutex) {
						move_page();
					}
				}
			}

			// Special keyup handling is necessary for caps lock
			// On Firefox/Mac, each press of caps lock only fires keydown
			// On Chrome/Mac, the first press of caps lock only fires keydown, and the second press only fires keyup,
			// as if the key had been held down for all the time that its light was on. (Safari is the same, but we discourage
			// use of Safari anyway).
			// On other browsers, it behaves like a normal key, ie it gets a keydown event when first pressed, 
			// possibly further keydown events on auto-repeat, and a keyup event when released.
			// So everything apart from Chrome/Mac can be handled by a keydown handler as long as it's not held down
			// long enough to auto-repeat. But for Chrome/Mac we might need to act on a keyup. 
			// So when there's a capslock keydown event, we set capslock_pressed_recently=true and set a timer to set
			// it to false after an interval. Then on a keyup event, here we check that flag; if it's still true, 
			// assume it was a single press event keydown+keyup
			function keyup_capslock() {
				if (! capslock_pressed_recently) {
					// Looks like this is a lone keyup event on a webkit browser which means the key was pressed a second time.
					// So fire the keydown handler.
					keydown_capslock();
				}
			}

			// onLoad setup
			$(function() {
				// Check browser supports rgba() colours (stolen from Modernizr)
				var rgba_check = function() {
					var elem = document.createElement('div');
    			var style = elem.style;
    			style.cssText = 'background-color:rgba(150,255,150,.5)';
    			return ('' + style.backgroundColor).indexOf('rgba') > -1;
    		};
    		if (! rgba_check()) {
    			$('.warning-rgba').dialog();
    			return false;
    		}
    		if (navigator.userAgent.match(/[Ss]afari/) && ! navigator.userAgent.match(/[Cc]hrome/)) { // Not perfect but this is only for advisory purposes
    			$('.warning-safari').dialog();
    		}
				// Sliders
				$('#ctrl_brokenness').slider({
					min: 0,
					max: max_brokenness,
					value: brokenness,
					slide: function(event, ui) {
						$('#disp_brokenness').html(ui.value);
					},						
					change: function(event, ui) {
						brokenness = ui.value;
						ink_variation = 1.0 * brokenness / 100;
					},
				});
				$('#ctrl_inklevel').slider({
					min: 0,
					max: max_ink_level,
					value: ink_remaining,
					slide: function(event, ui) {
						$('#disp_inklevel').html(ui.value);
					},						
					change: function(event, ui) {
						ink_remaining = ui.value;
					},
				});
				$('#disp_brokenness').html(brokenness);
				$('#disp_inklevel').html(ink_remaining);
				
				move_page();
				$('.cursor').css('top', vmid + 46).css('left', hmid + 31); // Magic numbers basically arrived at by trial and error...
				$.ionSound({
					path: "assets/typewriter_sounds/",
    			sounds: [
        		"typewriter-keydown-2",
        		"typewriter-keyup-2",
        		"typewriter-carriage-return-main",
        		"typewriter-carriage-return-stop",
        		"typewriter-spacebar",
        		"typewriter-bell-2",
    			],
    			multiPlay: true,
				});
				$(document)
				.on('keydown', function(e) { // I originally used keypress, but this ignores backspace on Chrome
					// console.log("keydown: " + e.which + " keydown_mutex " + keydown_mutex + " keypress_mutex " + keypress_mutex);
					keydown(e); 
				})
				.on('keypress', function(e) {
					// console.log("keypress: " + e.which + " keydown_mutex " + keydown_mutex + " keypress_mutex " + keypress_mutex);
					keypress(e);
				})
				.on('keyup', function(e) {
					// console.log("keyup: " + e.which + " keydown_mutex " + keydown_mutex + " keypress_mutex " + keypress_mutex);
					keyup(e);
				}); // on()
			}); //$()
