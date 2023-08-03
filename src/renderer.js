import * as THREE from "three";


export class Renderer {

	constructor({canvas, fps}) {
		this.loop = new FrameLoop(fps);

		this._renderer = new THREE.WebGLRenderer({canvas});

		// Size of the canvas element (in page pixels)
		this._canvas_width = canvas.clientWidth;
		this._canvas_height = canvas.clientHeight;
		this._renderer.setSize(this._canvas_width, this._canvas_height, false);
		this._canvas_size_changed = false;

		// Number of screen pixels per page pixel
		this._px_ratio = window.devicePixelRatio ?? 1;
		this._renderer.setPixelRatio(this._px_ratio);
		this._px_ratio_changed = false;

		// Watch for changes to the pixel ratio
		this._px_ratio_listener_cb = this._onPixelRatioChanged.bind(this);
		this._px_ratio_listener = matchMedia(`(resolution: ${this._px_ratio}dppx)`);
		this._px_ratio_listener.addEventListener("change", this._px_ratio_listener_cb);

		// Watch for changes to the canvas element's page size
		(new ResizeObserver((entries => {
			const rect = entries[0].contentRect;
			this._onCanvasSizeChanged(rect.width, rect.height);
		}))).observe(canvas);
	}

	render(scene, camera) {
		if (this._px_ratio_changed) {
			this._px_ratio_changed = false;
			this._renderer.setPixelRatio(this._px_ratio);
		}
		if (this._canvas_size_changed) {
			this._canvas_size_changed = false;
			this._renderer.setSize(this._canvas_width, this._canvas_height, false);
			camera.aspect = this._canvas_width / this._canvas_height;
			camera.updateProjectionMatrix();
		}

		this._renderer.render(scene, camera);
	}

	getCanvasAspectRatio() {
		return this._canvas_width / this._canvas_height;
	}

	_onCanvasSizeChanged(width, height) {
		this._canvas_width = width;
		this._canvas_height = height;
		this._canvas_size_changed = true;
	}

	_onPixelRatioChanged() {
		this._px_ratio = window.devicePixelRatio ?? 1;
		this._px_ratio_changed = true;

		this._px_ratio_listener.removeEventListener("change", this._px_ratio_listener_cb);
		this._px_ratio_listener = matchMedia(`(resolution: ${this._px_ratio}dppx)`);
		this._px_ratio_listener.addEventListener("change", this._px_ratio_listener_cb);
	}
}


class FrameLoop {

	constructor(fps) {
		// Whether the frame loop has started
		this.started = false;
		// Target number of ms between frames
		this.target_framerate = 1000 / fps;
		
		// Callback to call every frame
		this._frame_callback;
		// Timestamp of the last frame
		this._last_frame_time;
		// Handle for cancelAnimationFrame
		this._frame_loop_handle;
	}

	setTargetFramerate(fps) {
		this.target_framerate = 1000 / fps;
	}

	start(callback) {
		if (this.started) {
			this.stop();
		}

		this._frame_callback = callback;
		this._last_frame_time = undefined;
		this._frame_loop_handle = requestAnimationFrame(() => this._onFrame());
		this.started = true;

		return this;
	}

	pause() {
		if (this.started) {
			this._frame_callback = undefined;
			this._last_frame_time = undefined;
			cancelAnimationFrame(this._frame_loop_handle);
			this._frame_loop_handle = undefined;
			this.started = false;
		}

		return this;
	}

	_onFrame() {
		if (this.started) {
			this._frame_loop_handle = requestAnimationFrame(() => this._onFrame());

			const now = performance.now();

			if (this._last_frame_time === undefined) {
				this._last_frame_time = now;
				return;
			}
			
			const delta = now - this._last_frame_time;

			if (delta < this.target_framerate) {
				return;
			}

			if (this._frame_callback) {
				this._frame_callback(now, delta);
			}

			this._last_frame_time = now;
		}
	}
}