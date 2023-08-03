import * as THREE from "three";
import {ONE_HALF_PI} from "./util.js";


export class Player {

	constructor({position, rotation, controls, camera}) {
		const pos_x = position.x ?? 0;
		const pos_y = position.y ?? 0;
		const pos_z = position.z ?? 0;

		const rot_h = rotation.h ?? 0;
		const rot_v = rotation.v ?? 0;

		const camera_fov = camera.fov ?? 45;
		const camera_height = camera.height ?? 1.62;

		this._camera = new THREE.PerspectiveCamera(camera_fov);
		this._camera.position.x = pos_x;
		this._camera.position.y = pos_y + camera_height;
		this._camera.position.z = pos_z;
		this._camera.rotation.x = rot_v;
		this._camera.rotation.y = rot_h;
		this._camera.rotation.z = 0;
		this._camera.rotation.order = "YXZ";

		this.controls = new PlayerController(controls);
	}

	update(deltatime) {
		const controls = this.controls;

		controls.onBeforeFrame();

		const controls_for_move = controls.controls_for_move;
		const controls_for_turn = controls.controls_for_turn;

		const per_second = deltatime / 1000;

		const turn_amount_h = controls_for_turn.turn_speed_horz * (controls.base_turn_speed * per_second);
		const turn_amount_v = controls_for_turn.turn_speed_vert * (controls.base_turn_speed * per_second);

		if (turn_amount_h !== 0) {
			this._camera.rotation.y -= turn_amount_h;
		}

		if (turn_amount_v !== 0) {
			this._camera.rotation.x += turn_amount_v;

			if (this._camera.rotation.x < -1.5) {
				this._camera.rotation.x = -1.5;
			}
			else if (this._camera.rotation.x > 1.5) {
				this._camera.rotation.x = 1.5;
			}
		}

		const move_speed = controls_for_move.move_speed * (controls.base_move_speed * per_second);
		const move_angle = this._camera.rotation.y - controls_for_move.move_angle;

		if (move_speed !== 0) {
			const delta_x = move_speed * Math.sin(move_angle);
			const delta_z = move_speed * Math.cos(move_angle);

			this._camera.position.x -= delta_x;
			this._camera.position.z -= delta_z;
		}
	}
}


class PlayerController {

	constructor({
		keymap={},
		base_move_speed=2,
		base_turn_speed=3,
		sprint_move_multiplier=1.5,
		sprint_turn_multiplier=1.5,
		mouse_sensitivity=0.07
	}) {

		this.default_base_move_speed = base_move_speed;
		this.default_base_turn_speed = base_turn_speed;

		this.base_move_speed = this.default_base_move_speed;
		this.base_turn_speed = this.default_base_turn_speed;

		this.sprint_move_multiplier = sprint_move_multiplier;
		this.sprint_turn_multiplier = sprint_turn_multiplier;

		//////////

		// The set of controls which are currently being used.
		this.controls_for_move = undefined;
		this.controls_for_turn = undefined;

		this.keyboard_controls = new KeyboardControls(this, keymap);
		this.touch_controls = new TouchControls(this);
		this.mouse_controls = new MouseLookControls(this, mouse_sensitivity);

		this.mouse_controls.capture_elem.addEventListener("click", () => {
			if (!this.mouse_controls.is_captured) {
				this.mouse_controls.startCapture().then(console.log);
			}
		});
	}

	onBeforeFrame() {
		if (this.mouse_controls.is_captured) {
			this.mouse_controls.onBeforeFrame();
		}

		this.controls_for_move = this.keyboard_controls;
		this.controls_for_turn = this.mouse_controls;

		if (this.touch_controls.being_used_to_move) {
			this.controls_for_move = this.touch_controls;
		}

		if (this.touch_controls.being_used_to_turn) {
			this.controls_for_turn = this.touch_controls;
		}
		else if (this.keyboard_controls.being_used_to_turn) {
			this.controls_for_turn = this.keyboard_controls;
		}
	}
}


class KeyboardControls {

	constructor(controller, keymap) {
		this.controller = controller;

		this.move_speed = 0;
		this.move_angle = 0;
		this.being_used_to_move = false;

		this.turn_speed_horz = 0;
		this.turn_speed_vert = 0;
		this.being_used_to_turn = false;

		// We would stop listening whenever the player is not under
		// control, e.g. in a cutscene or when the UI is active.
		this.is_listening = true;

		// Set defaults for unset keymap values
		keymap = {
			"MoveFwd": "w",
			"MoveBack": "s",
			"MoveLeft": "a",
			"MoveRight": "d",

			"LookUp": "ArrowUp",
			"LookDown": "ArrowDown",
			"LookLeft": "ArrowLeft",
			"LookRight": "ArrowRight",

			"Sprint": "Shift",
			...keymap
		};

		this.ACTION_TO_KEY = new Map();
		this.KEY_TO_ACTION = new Map();

		// Which actions currently have their key held down
		this.pressing = new Map();

		for (const [action, key] of Object.entries(keymap)) {
			this.ACTION_TO_KEY.set(action, key);
			this.KEY_TO_ACTION.set(key, action);
			this.pressing.set(action, false);
		}

		// Actions that trigger a move or turn recalculation when their key is pressed or released.
		this.RECALC_MOVE_ACTIONS = new Set(["MoveFwd", "MoveBack", "MoveLeft", "MoveRight", "Sprint"]);
		this.RECALC_TURN_ACTIONS = new Set(["LookUp", "LookDown", "LookLeft", "LookRight", "Sprint"]);

		document.addEventListener("keyup", this.onKeyUp.bind(this), {capture: true});
		document.addEventListener("keydown", this.onKeyDown.bind(this), {capture: true});
		window.addEventListener("blur", this.onDocumentFocusChanged.bind(this), {capture: true});
		window.addEventListener("focus", this.onDocumentFocusChanged.bind(this), {capture: true});
	}

	startListening() {
		if (this.is_listening) return;

		this.is_listening = true;
	}

	stopListening() {
		if (!this.is_listening) return;

		this.is_listening = false;

		// When listening is paused, pretend all keys were released.

		for (const action of this.ACTION_TO_KEY) {
			if (this.pressing.get(action) === true) {
				this.pressing.set(action, false);
			}
		}

		this.move_speed = 0;
		this.move_angle = 0;
		this.being_used_to_move = false;

		this.turn_speed_horz = 0;
		this.turn_speed_vert = 0;
		this.being_used_to_turn = false;
	}

	onKeyDown(evt) {
		if (!this.is_listening) return;

		// Ignore repeated keydowns when holding down a key
		if (evt.repeat) return;

		const action = this.KEY_TO_ACTION.get(evt.key);

		// Ignore keys that aren't associated with an action
		if (action === undefined) return;

		// Stop default browser behavior
		evt.preventDefault();
		evt.stopPropagation();

		if (this.pressing.get(action) === false) {
			this.pressing.set(action, true);

			if (this.RECALC_MOVE_ACTIONS.has(action)) {
				this.calculateMove();
			}
			if (this.RECALC_TURN_ACTIONS.has(action)) {
				this.calculateTurn();
			}
		}
	}

	onKeyUp(evt) {
		if (!this.is_listening) return;

		const action = this.KEY_TO_ACTION.get(evt.key);

		// Ignore keys that aren't associated with an action
		if (action === undefined) return;

		// Stop default browser behavior
		evt.preventDefault();
		evt.stopPropagation();

		if (this.pressing.get(action) === true) {
			this.pressing.set(action, false);

			if (this.RECALC_MOVE_ACTIONS.has(action)) {
				this.calculateMove();
			}
			if (this.RECALC_TURN_ACTIONS.has(action)) {
				this.calculateTurn();
			}
		}
	}

	onDocumentFocusChanged() {
		if (document.hasFocus()) {
			this.startListening();
		}
		else {
			this.stopListening();
		}
	}

	calculateMove() {
		let horz_move = 0;
		let vert_move = 0;
		let move_angle = 0;

		this.being_used_to_move = false;

		if (this.pressing.get("MoveRight")) {
			this.being_used_to_move = true;
			horz_move += 1;
			move_angle += Math.PI / 2;
		}
		if (this.pressing.get("MoveLeft")) {
			this.being_used_to_move = true;
			horz_move -= 1;
			move_angle -= Math.PI / 2;
		}
		if (this.pressing.get("MoveFwd")) {
			this.being_used_to_move = true;
			vert_move += 1;
			move_angle /= 2;
		}
		if (this.pressing.get("MoveBack")) {
			this.being_used_to_move = true;
			vert_move -= 1;
			move_angle = Math.PI - (move_angle / 2);
		}

		if (horz_move || vert_move) {
			this.move_speed = 1;
			this.move_angle = move_angle;
		}
		else {
			this.move_speed = 0;
			this.move_angle = 0;
		}

		if (this.pressing.get("Sprint")) {
			this.move_speed = this.controller.sprint_move_multiplier;
		}
	}

	calculateTurn() {
		let horz_turn = 0;
		let vert_turn = 0;

		this.being_used_to_turn = false;

		if (this.pressing.get("LookUp")) {
			this.being_used_to_turn = true;
			vert_turn += 1;
		}
		if (this.pressing.get("LookDown")) {
			this.being_used_to_turn = true;
			vert_turn -= 1;
		}
		if (this.pressing.get("LookRight")) {
			this.being_used_to_turn = true;
			horz_turn += 1;
		}
		if (this.pressing.get("LookLeft")) {
			this.being_used_to_turn = true;
			horz_turn -= 1;
		}

		this.turn_speed_horz = horz_turn;
		this.turn_speed_vert = vert_turn;

		if (this.pressing.get("Sprint")) {
			this.turn_speed_horz = this.controller.sprint_turn_multiplier;
			this.turn_speed_vert = this.controller.sprint_turn_multiplier;
		}
	}
}


class TouchControls {

	constructor(controller) {
		this.controller = controller;

		this.move_speed = 0;
		this.move_angle = 0;
		this.being_used_to_move = false;

		this.turn_speed_horz = 0;
		this.turn_speed_vert = 0;
		this.being_used_to_turn = false;

		// Max distance (in pixels) a touch can move before it will no longer
		// trigger a tap event.
		this.MAX_TAP_DISTANCE = 10;

		// Max duration (in ms) a touch can be held before it will no longer
		// trigger a tap event.
		this.MAX_TAP_DURATION = 500;

		// Map (identifier -> Touch object) of all active touches on the screen
		this.active_touches = new Map();

		// Element on which to watch for touches. Touches not on this element
		// are not monitored.
		this.touch_area_elem = document.querySelector("#user-interface .touch-area");

		this.touch_area_elem.addEventListener("touchstart", this._onTouchStart.bind(this), {capture: true});
		this.touch_area_elem.addEventListener("touchmove", this._onTouchMove.bind(this), {capture: true});
		this.touch_area_elem.addEventListener("touchend", this._onTouchEnd.bind(this), {capture: true});
		this.touch_area_elem.addEventListener("touchcancel", this._onTouchEnd.bind(this), {capture: true});

		// Watch for changes in the size of the touch area. If the size changes,
		// invalidate all active touches.
		(new ResizeObserver(this._onTouchAreaSizeChanged.bind(this))).observe(this.touch_area_elem);

		//////////

		// Distance (in pixels) at which the control strength of a drag
		// reaches its maximum.
		this.MAX_CONTROL_DISTANCE = 150;

		// References to the touches which are currently being used to control
		// the movement and camera. These are controlled by dragging your
		// finger on the left (movement) or right (camera) side of the screen.
		this.control_touches = {
			"move": undefined,
			"look": undefined
		};

		this.touch_indicator_elems = {
			"move": document.querySelector("#user-interface .move-indicator"),
			"look": document.querySelector("#user-interface .look-indicator")
		};

		// Handle for the next animation frame. The animation loop runs while
		// there is at least one current control touch.
		this._pending_animation_frame = undefined;
	}

	_onTouchStart(evt) {
		for (const _touch of evt.changedTouches) {

			// Add a new touch to the active touches list
			const touch = new Touch(_touch.identifier, _touch.clientX, _touch.clientY);
			this.active_touches.set(touch.id, touch);
		}
	}

	_onTouchMove(evt) {
		for (const _touch of evt.changedTouches) {

			const touch = this.active_touches.get(_touch.identifier);
			if (touch === undefined) return;

			// Update the touch position and magnitude
			touch.pos_x = _touch.clientX;
			touch.pos_y = _touch.clientY;

			const delta_x = touch.pos_x - touch.start_x;
			const delta_y = touch.pos_y - touch.start_y;
	
			touch.magnitude = ((delta_x * delta_x) + (delta_y * delta_y)) ** 0.5;
			touch.scaled_magnitude = (touch.magnitude - this.MAX_TAP_DISTANCE) / (this.MAX_CONTROL_DISTANCE - this.MAX_TAP_DISTANCE);

			if (touch.action === "drag") {
				// Only update the angle if the touch is a drag
				touch.angle = Math.atan2(delta_y, delta_x);
				this._handleDragMove(touch);
			}
			else if (touch.action === "tap") {
				// If the distance the tap has moved exceeds the maximum
				// distance for a tap, consider it a drag instead.
				if (touch.magnitude > this.MAX_TAP_DISTANCE) {
					touch.action = "drag";
					touch.angle = Math.atan2(delta_y, delta_x);
					this._handleDragStart(touch);
				}
			}
		}
	}

	_onTouchEnd(evt) {
		for (const _touch of evt.changedTouches) {

			const touch = this.active_touches.get(_touch.identifier);
			if (touch === undefined) return;

			// Remove the touch from the active touches list
			this.active_touches.delete(touch.id);

			if (touch.action === "drag") {
				this._handleDragEnd(touch);
			}
			else if (touch.action === "tap") {
				const cur_time = performance.now();

				// Only trigger a tap event if the touch has been held down
				// for no longer than the maximum duration for a tap.
				if (cur_time - touch.start_time <= this.MAX_TAP_DURATION) {
					this._handleTap(touch);
				}
			}
		}
	}

	// Invalidate all active touches if the size of the touch area ever changes
	_onTouchAreaSizeChanged() {
		for (const touch of this.active_touches.values()) {
			if (touch.action === "drag") {
				this._handleDragEnd(touch);
			}
			else if (touch.action === "tap") {
				// Do nothing. Don't trigger a tap event/
			}

			this.active_touches.delete(touch.id);
		}
	}

	_handleTap(touch) {

	}

	_handleDragStart(touch) {
		let kind = undefined;

		// If the drag started on the left 45% of the screen, treat it as a
		// movement control. If the drag started on the right 45% of the screen,
		// treat it as a camera control. If the drag started in the middle 10%
		// of the screen, decide whether it's a movement or camera control
		// based on the initial angle of the touch -- movement if the finger
		// moved left and camera if the finger moved right.
		const screen_width = this.touch_area_elem.clientWidth;
		const left_boundary = (screen_width / 2) - (screen_width * 0.05);
		const right_boundary = (screen_width / 2) + (screen_width * 0.05);

		if (touch.start_x <= left_boundary) {
			kind = "move";
		}
		else if (touch.start_x >= right_boundary) {
			kind = "look";
		}
		else {
			console.log(left_boundary, right_boundary, touch.angle);

			// If the touch moved in a rightward direction...
			if (touch.angle >= -Math.PI / 2 && touch.angle <= Math.PI /2) {
				kind = "look";
			}
			else {
				kind = "move";
			}
		}

		touch.drag_kind = kind;

		if (this.control_touches[touch.drag_kind] === undefined) {
			this.control_touches[touch.drag_kind] = touch;
			touch._position_changed_since_last_frame = true;
			this._showIndicator(touch);

			if (touch.drag_kind === "move") {
				this.move_speed = 0;
				this.move_angle = 0;
				this.being_used_to_move = true;
			}
			else if (touch.drag_kind === "look") {
				this.turn_speed_horz = 0;
				this.turn_speed_vert = 0;
				this.being_used_to_turn = true;
			}
			
			if (this._pending_animation_frame === undefined) {
				this._pending_animation_frame = requestAnimationFrame(() => this._animationFrame());
			}
		}
	}

	_handleDragMove(touch) {
		// If the touch that ended is one of the current control touches...
		if (touch.id === this.control_touches[touch.drag_kind]?.id) {
			touch._position_changed_since_last_frame = true;

			if (touch.drag_kind === "move") {
				this.move_speed = touch.scaled_magnitude * this.controller.sprint_move_multiplier;
				this.move_angle = touch.angle + ONE_HALF_PI;
			}
			else if (touch.drag_kind === "look") {
				const turn_speed = touch.scaled_magnitude * this.controller.sprint_turn_multiplier;
				const turn_angle = touch.angle + ONE_HALF_PI;

				this.turn_speed_horz = turn_speed * Math.sin(turn_angle);
				this.turn_speed_vert = turn_speed * Math.cos(turn_angle);
			}
		}
	}

	_handleDragEnd(touch) {
		// If the touch that ended is one of the current control touches...
		if (touch.id === this.control_touches[touch.drag_kind]?.id) {
			this.control_touches[touch.drag_kind] = undefined;
			this._hideIndicator(touch);

			if (touch.drag_kind === "move") {
				this.move_speed = 0;
				this.move_angle = 0;
				this.being_used_to_move = false;
			}
			else if (touch.drag_kind === "look") {
				this.turn_speed_horz = 0;
				this.turn_speed_vert = 0;
				this.being_used_to_turn = false;
			}
	
			// If both control touches are now undefined...
			if (this.control_touches.move === undefined && this.control_touches.look === undefined) {
				cancelAnimationFrame(this._pending_animation_frame);
				this._pending_animation_frame = undefined;
			}
		}
	}

	_showIndicator(touch) {
		const indicator = this.touch_indicator_elems[touch.drag_kind];

		indicator.style.setProperty("--posX", touch.start_x + "px");
		indicator.style.setProperty("--posY", touch.start_y + "px");
		indicator.style.setProperty("--show", 1);

		touch._position_changed_since_last_frame = true;
	}

	_updateIndicator(touch) {
		const indicator = this.touch_indicator_elems[touch.drag_kind];

		const angle = touch.angle + (Math.PI / 2);
		const magnitude = touch.scaled_magnitude * 188.495559;

		indicator.style.setProperty("--angle", angle + "rad");
		indicator.style.setProperty("--magnitude", (magnitude > 0) ? magnitude : 0);
		indicator.style.setProperty("--showArrow", (magnitude > 0) ? 1 : 0);

		touch._position_changed_since_last_frame = false;
	}

	_hideIndicator(touch) {
		const indicator = this.touch_indicator_elems[touch.drag_kind];

		indicator.style.setProperty("--show", 0);
	}

	_animationFrame() {
		this._pending_animation_frame = requestAnimationFrame(() => this._animationFrame());

		if (this.control_touches.move?._position_changed_since_last_frame === true) {
			this._updateIndicator(this.control_touches.move);
		}
		if (this.control_touches.look?._position_changed_since_last_frame === true) {
			this._updateIndicator(this.control_touches.look);
		}
	}
}


class Touch {

	constructor(id, x, y) {
		this.id = id;

		this.pos_x = x;
		this.pos_y = y;

		this.start_x = x;
		this.start_y = y;

		this.start_time = performance.now();

		// Remember y-axis goes top to bottom
		this.angle = 0;
		this.magnitude = 0;
		this.scaled_magnitude = 0;

		// Either "tap" or "drag"
		this.action = "tap";
		// Either "move" or "look"
		this.drag_kind = undefined;

		// Only used for drags.
		this._position_changed_since_last_frame = false;
	}
}


class MouseLookControls {

	constructor(controller, sensitivity) {
		this.controller = controller;
		this.sensitivity = sensitivity;

		this.turn_speed_horz = 0;
		this.turn_speed_vert = 0;
		this.being_used_to_turn = false;

		this.is_captured = false;

		this._delta_x_since_last_frame = 0;
		this._delta_y_since_last_frame = 0;

		this._change_listener = undefined;
		this._move_listener = undefined;

		this.capture_elem = document.querySelector("#user-interface .touch-area");
	}

	async startCapture() {
		this.resetToDefault();

		let change_listener = undefined;
		let error_listener = undefined;

		await new Promise(async (resolve, reject) => {
			// Wait for the pointer lock to fully register before resolving
			change_listener = () => {
				if (document.pointerLockElement) {
					resolve();
				}
			};

			// Reject if there's an error
			error_listener = () => {
				reject(new Error("Unknown pointer lock error"));
			};

			document.addEventListener("pointerlockchange", change_listener);
			document.addEventListener("pointerlockerror", error_listener);

			try {
				await this.capture_elem.requestPointerLock({
					unadjustedMovement: true
				});
			}
			catch (err) {
				// If we get a not supported error, try again without requesting
				// unadjusted movement (i.e. no mouse acceleration).
				if (err.name === "NotSupportedError") {
					await this.capture_elem.requestPointerLock();
				}
				else {
					reject(err);
				}
			}
		});

		// Remove temporary event listeners
		document.removeEventListener("pointerlockchange", change_listener);
		document.removeEventListener("pointerlockerror", error_listener);

		// Add main event listeners
		this._change_listener = this.onPointerLockChange.bind(this);
		this._move_listener = this.onMouseMove.bind(this);

		document.addEventListener("pointerlockchange", this._change_listener);
		this.capture_elem.addEventListener("mousemove", this._move_listener);

		this.is_captured = true;

		return true;
	}

	async stopCapture() {
		this.resetToDefault();

		await document.exitPointerLock();

		return true;
	}

	onPointerLockChange() {
		if (!document.pointerLockElement) {
			this.resetToDefault();
		}
	}

	onMouseMove(evt) {
		this._delta_x_since_last_frame += evt.movementX;
		this._delta_y_since_last_frame -= evt.movementY;
	}

	onBeforeFrame() {
		if (!this.is_captured) {
			return false;
		}

		this.turn_speed_horz = this._delta_x_since_last_frame * this.sensitivity;
		this.turn_speed_vert = this._delta_y_since_last_frame * this.sensitivity;

		this._delta_x_since_last_frame = 0;
		this._delta_y_since_last_frame = 0;

		this.being_used_to_turn = (this.turn_speed_horz || this.turn_speed_vert);
	}

	resetToDefault() {
		document.removeEventListener("pointerlockchange", this._change_listener);
		this.capture_elem.removeEventListener("mousemove", this._move_listener);

		this.turn_speed_horz = 0;
		this.turn_speed_vert = 0;
		this.being_used_to_turn = false;

		this.is_captured = false;

		this._delta_x_since_last_frame = 0;
		this._delta_y_since_last_frame = 0;

		this._change_listener = undefined;
		this._move_listener = undefined;
	}
}