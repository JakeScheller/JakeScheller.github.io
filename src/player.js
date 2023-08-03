import * as THREE from "three";
import {ONE_HALF_PI} from "./util.js";


export class Player {

	constructor({position, rotation, camera}) {
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

		this.controls = new PlayerController();

		this._info = document.getElementById("info");
	}

	update(deltatime) {
		const controls = this.controls;
		controls.update();

		const per_second = deltatime / 1000;

		const turn_amount_h = controls.turn_speed_h * per_second;
		const turn_amount_v = controls.turn_speed_v * per_second;

		this._camera.rotation.y -= turn_amount_h;
		this._camera.rotation.x += turn_amount_v;

		if (this._camera.rotation.x > 1.5) {
			this._camera.rotation.x = 1.5;
		}
		else if (this._camera.rotation.x < -1.5) {
			this._camera.rotation.x = -1.5;
		}

		const move_speed = controls.move_speed * per_second;
		const move_angle = this._camera.rotation.y - controls.move_angle;

		if (move_speed !== 0) {
			const move_amount_x = move_speed * Math.sin(move_angle);
			const move_amount_z = move_speed * Math.cos(move_angle);

			this._camera.position.x -= move_amount_x;
			this._camera.position.z -= move_amount_z;
		}
	}
}


class PlayerController {

	constructor() {
		this.mouse_controls = new MouseLookControls(this);
		this.keyboard_controls = new KeyboardControls(this);
		this.touch_controls = new TouchControls(this);

		this.touch_controls.startListening();
		this.keyboard_controls.startListening();
		
		this.mouse_controls._capture_elem.addEventListener("click", () => {
			if (this.mouse_controls.is_captured) {
				this.mouse_controls.releaseCapture();
			}
			else {
				this.mouse_controls.requestCapture();
			}
		});

		//////////

		this.BASE_MOVE_SPEED = 3;
		this.BASE_TURN_SPEED = 2;

		this.move_angle = 0;
		this.move_speed = 0;

		this.turn_speed_h = 0;
		this.turn_speed_v = 0;

		//////////

		this.MOUSE_SENSITIVITY = 0.1;

		//////////

		this.KBD_MOVE_ACTIONS = new Set(["MoveFwd", "MoveBack", "MoveLeft", "MoveRight"]);
		this.KBD_LOOK_ACTIONS = new Set(["LookUp", "LookDown", "LookLeft", "LookRight"]);

		this.kbd_move_angle = 0;
		this.kbd_move_speed = 0;

		this.kbd_turn_speed_h = 0;
		this.kbd_turn_speed_v = 0;

		this.kbd_currently_moving = false;
		this.kbd_currently_turning = false;
	}

	update() {
		const move_touch = this.touch_controls.control_touches.move;
		const look_touch = this.touch_controls.control_touches.look;

		if (move_touch) {
			if (move_touch.updated_since_last_frame) {
				this.touch_controls._updateIndicator(move_touch);
				move_touch.updated_since_last_frame = false;

				this.move_angle = move_touch.angle + ONE_HALF_PI;
				this.move_speed = move_touch.magnitude * this.BASE_MOVE_SPEED;
			}
		}
		else if (this.kbd_currently_moving) {
			this.move_angle = this.kbd_move_angle;
			this.move_speed = this.kbd_move_speed;
		}
		else {
			this.move_angle = 0;
			this.move_speed = 0;
		}

		if (look_touch) {
			if (look_touch.updated_since_last_frame) {
				this.touch_controls._updateIndicator(look_touch);
				look_touch.updated_since_last_frame = false;

				const angle = look_touch.angle + ONE_HALF_PI;
				const magnitude = look_touch.magnitude * this.BASE_TURN_SPEED;
				this.turn_speed_h = magnitude * Math.sin(angle);
				this.turn_speed_v = magnitude * Math.cos(angle);
			}
		}
		else if (this.kbd_currently_turning) {
			this.turn_speed_h = this.kbd_turn_speed_h;
			this.turn_speed_v = this.kbd_turn_speed_v;
		}
		else if (this.mouse_controls.moved_since_last_frame) {
			this.turn_speed_h = this.mouse_controls.delta_x * this.MOUSE_SENSITIVITY;
			this.turn_speed_v = this.mouse_controls.delta_y * this.MOUSE_SENSITIVITY;

			this.mouse_controls.delta_x = 0;
			this.mouse_controls.delta_y = 0;

			this.mouse_controls.moved_since_last_frame = false;
		}
		else {
			this.turn_speed_h = 0;
			this.turn_speed_v = 0;
		}
	}

	_onKeyboardActionStateChange(action, change) {
		if (this.KBD_MOVE_ACTIONS.has(action)) {
			this._updateKeyboardMoveValues();
		}
		else if (this.KBD_LOOK_ACTIONS.has(action)) {
			this._updateKeyboardLookValues();
		}
	}

	_onKeyboardResetToDefault() {
		this.kbd_move_angle = 0;
		this.kbd_move_speed = 0;

		this.kbd_turn_speed_h = 0;
		this.kbd_turn_speed_v = 0;

		this.kbd_currently_moving = false;
		this.kbd_currently_turning = false;
	}

	_updateKeyboardMoveValues() {
		const pressing = this.keyboard_controls.pressing;

		let horz_move = 0;
		let vert_move = 0;
		let move_angle = 0;

		this.kbd_currently_moving = false;

		if (pressing.get("MoveRight")) {
			horz_move += 1;
			move_angle += ONE_HALF_PI;
			this.kbd_currently_moving = true;
		}
		if (pressing.get("MoveLeft")) {
			horz_move -= 1;
			move_angle -= ONE_HALF_PI;
			this.kbd_currently_moving = true;
		}
		if (pressing.get("MoveFwd")) {
			vert_move += 1;
			move_angle /= 2;
			this.kbd_currently_moving = true;
		}
		if (pressing.get("MoveBack")) {
			vert_move -= 1;
			move_angle = Math.PI - (move_angle / 2);
			this.kbd_currently_moving = true;
		}

		if (horz_move || vert_move) {
			this.kbd_move_angle = move_angle;
			this.kbd_move_speed = this.BASE_MOVE_SPEED;
		}
		else {
			this.kbd_move_angle = 0;
			this.kbd_move_speed = 0;
		}
	}

	_updateKeyboardLookValues() {
		const pressing = this.keyboard_controls.pressing;

		let horz_turn = 0;
		let vert_turn = 0;

		this.kbd_currently_turning = false;

		if (pressing.get("LookUp")) {
			vert_turn += 1;
			this.kbd_currently_turning = true;
		}
		if (pressing.get("LookDown")) {
			vert_turn -= 1;
			this.kbd_currently_turning = true;
		}
		if (pressing.get("LookRight")) {
			horz_turn += 1;
			this.kbd_currently_turning = true;
		}
		if (pressing.get("LookLeft")) {
			horz_turn -= 1;
			this.kbd_currently_turning = true;
		}

		this.kbd_turn_speed_h = this.BASE_TURN_SPEED * horz_turn;
		this.kbd_turn_speed_v = this.BASE_TURN_SPEED * vert_turn;
	}
}


class MouseLookControls {

	constructor(controller) {
		this.controller = controller;

		this.is_captured = false;
		this.is_listening = false;

		this.delta_x = 0;
		this.delta_y = 0;
		this.moved_since_last_frame = false;

		this._move_listener = this._onMove.bind(this);

		this._capture_elem = document.querySelector("#user-interface .touch-area");

		document.addEventListener("pointerlockchange", this._onPointerLockChange.bind(this));
	}

	startListening() {
		if (!this.is_captured) return;

		this.delta_x = 0;
		this.delta_y = 0;
		this.moved_since_last_frame = false;

		this._capture_elem.removeEventListener("mousemove", this._move_listener);
		this._capture_elem.addEventListener("mousemove", this._move_listener);

		this.is_listening = true;
	}

	stopListening() {
		if (!this.is_captured) return;

		this.delta_x = 0;
		this.delta_y = 0;
		this.moved_since_last_frame = false;

		this._capture_elem.removeEventListener("mousemove", this._move_listener);

		this.is_listening = false;
	}

	async requestCapture() {
		if (this.is_captured) return;

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
				await this._capture_elem.requestPointerLock({
					unadjustedMovement: true
				});
			}
			catch (err) {
				// If we get a not supported error, try again without requesting
				// unadjusted movement (i.e. no mouse acceleration).
				if (err.name === "NotSupportedError") {
					await this._capture_elem.requestPointerLock();
				}
				else {
					reject(err);
				}
			}
		});

		// Remove temporary event listeners
		document.removeEventListener("pointerlockchange", change_listener);
		document.removeEventListener("pointerlockerror", error_listener);
	}

	async releaseCapture() {
		if (!this.is_captured) return;

		await document.exitPointerLock();
	}

	_onPointerLockChange() {
		if (document.pointerLockElement === this._capture_elem) {
			this.is_captured = true;
			this.startListening();
		}
		else {
			this.stopListening();
			this.is_captured = false;
		}
	}

	_onMove(evt) {
		this.delta_x += evt.movementX;
		this.delta_y -= evt.movementY;
		this.moved_since_last_frame = true;
	}
}


class KeyboardControls {

	constructor(controller) {
		this.controller = controller;

		// Would be set to false when player is not in control, e.g. in a cutscene.
		this.is_listening = false;

		const keymap = {
			"MoveFwd": "w",
			"MoveBack": "s",
			"MoveLeft": "a",
			"MoveRight": "d",

			"LookUp": "ArrowUp",
			"LookDown": "ArrowDown",
			"LookLeft": "ArrowLeft",
			"LookRight": "ArrowRight",
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

		document.addEventListener("keyup", this._onKeyUp.bind(this), {capture: true});
		document.addEventListener("keydown", this._onKeyDown.bind(this), {capture: true});
		window.addEventListener("blur", this._onDocumentFocusChanged.bind(this), {capture: true});
		window.addEventListener("focus", this._onDocumentFocusChanged.bind(this), {capture: true});
	}

	startListening() {
		if (this.is_listening) return;

		this.is_listening = true;
		this._resetToDefault();
	}

	stopListening() {
		if (!this.is_listening) return;

		this.is_listening = false;
		this._resetToDefault();
	}

	_onDocumentFocusChanged() {
		if (document.hasFocus()) {
			this.startListening();
		}
		else {
			this.stopListening();
		}
	}

	_onKeyDown(evt) {
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
			this.controller._onKeyboardActionStateChange(action, "keydown");
		}
	}

	_onKeyUp(evt) {
		if (!this.is_listening) return;

		const action = this.KEY_TO_ACTION.get(evt.key);

		// Ignore keys that aren't associated with an action
		if (action === undefined) return;

		// Stop default browser behavior
		evt.preventDefault();
		evt.stopPropagation();

		if (this.pressing.get(action) === true) {
			this.pressing.set(action, false);
			this.controller._onKeyboardActionStateChange(action, "keyup");
		}
	}

	_resetToDefault() {
		for (const action of this.ACTION_TO_KEY) {
			if (this.pressing.get(action) === true) {
				this.pressing.set(action, false);
			}
		}

		this.controller._onKeyboardResetToDefault();
	}
}


class TouchControls {

	constructor(controller) {
		this.controller = controller;

		this.is_listening = false;

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
		// reaches its minimum and maximum.
		this.MIN_DRAG_DISTANCE = 10;
		this.MAX_DRAG_DISTANCE = 100;

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
	}

	startListening() {
		if (this.is_listening) return;

		this.is_listening = true;
		this._resetToDefault();
	}

	stopListening() {
		if (!this.is_listening) return;

		this.is_listening = false;
		this._resetToDefault();
	}

	// Invalidate all active touches if the size of the touch area ever changes
	_onTouchAreaSizeChanged() {
		if (!this.is_listening) return;

		this._resetToDefault();
	}

	_onTouchStart(evt) {
		if (!this.is_listening) return;

		for (const _touch of evt.changedTouches) {

			// Add a new touch to the active touches list
			const touch = new Touch(_touch.identifier, _touch.clientX, _touch.clientY);
			this.active_touches.set(touch.id, touch);
		}
	}

	_onTouchMove(evt) {
		if (!this.is_listening) return;

		for (const _touch of evt.changedTouches) {

			const touch = this.active_touches.get(_touch.identifier);
			if (touch === undefined) return;

			// Update the touch position, magnitude, and angle
			touch.pos_x = _touch.clientX;
			touch.pos_y = _touch.clientY;

			const delta_x = touch.pos_x - touch.start_x;
			const delta_y = touch.pos_y - touch.start_y;
	
			const magnitude = ((delta_x * delta_x) + (delta_y * delta_y)) ** 0.5;

			// Scale the magnitude to be between 0 and 1
			touch.magnitude = (magnitude - this.MIN_DRAG_DISTANCE) / (this.MAX_DRAG_DISTANCE - this.MIN_DRAG_DISTANCE);
			touch.angle = Math.atan2(delta_y, delta_x);

			if (touch.magnitude < 0) {
				touch.magnitude = 0;
			}
			else if (touch.magnitude > 1) {
				touch.magnitude = 1;
			}

			if (touch.action === undefined && touch.magnitude > 0) {
				this._handleDragStart(touch);
			}

			if (touch.action !== undefined) {
				this._handleDragMove(touch);
			}
		}
	}

	_onTouchEnd(evt) {
		if (!this.is_listening) return;

		for (const _touch of evt.changedTouches) {

			const touch = this.active_touches.get(_touch.identifier);
			if (touch === undefined) return;

			// Remove the touch from the active touches list
			this.active_touches.delete(touch.id);

			this._handleDragEnd(touch);
		}
	}

	_handleDragStart(touch) {
		let action = undefined;

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
			action = "move";
		}
		else if (touch.start_x >= right_boundary) {
			action = "look";
		}
		else {
			// If the touch moved in a rightward direction...
			if (touch.angle >= -ONE_HALF_PI && touch.angle <= ONE_HALF_PI) {
				action = "look";
			}
			else {
				action = "move";
			}
		}

		touch.action = action;

		if (this.control_touches[touch.action] === undefined) {
			this.control_touches[touch.action] = touch;
			this._showIndicator(touch);
		}
	}

	_handleDragMove(touch) {
		// If the touch that ended is one of the current control touches...
		if (touch.id === this.control_touches[touch.action]?.id) {
			touch.updated_since_last_frame = true;
		}
	}

	_handleDragEnd(touch) {
		// If the touch that ended is one of the current control touches...
		if (touch.id === this.control_touches[touch.action]?.id) {
			this.control_touches[touch.action] = undefined;
			touch.updated_since_last_frame = false;
			this._hideIndicator(touch);
		}
	}

	_showIndicator(touch) {
		const indicator = this.touch_indicator_elems[touch.action];

		indicator.style.setProperty("--posX", touch.start_x + "px");
		indicator.style.setProperty("--posY", touch.start_y + "px");
		indicator.style.setProperty("--show", 1);
	}

	_updateIndicator(touch) {
		const indicator = this.touch_indicator_elems[touch.action];

		const angle = touch.angle + ONE_HALF_PI;
		const magnitude = touch.magnitude * 188.495559;

		indicator.style.setProperty("--angle", angle + "rad");
		indicator.style.setProperty("--magnitude", magnitude);
		indicator.style.setProperty("--showArrow", (magnitude > 0) ? 1 : 0);
	}

	_hideIndicator(touch) {
		const indicator = this.touch_indicator_elems[touch.action];

		indicator.style.setProperty("--show", 0);
	}

	_resetToDefault() {
		for (const touch of this.active_touches.values()) {
			this._handleDragEnd(touch);
			this.active_touches.delete(touch.id);
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

		// Remember y-axis goes top to bottom
		this.angle = 0;
		this.magnitude = 0;

		// Either "move" or "look"
		this.action = undefined;

		this.updated_since_last_frame = false;
	}
}