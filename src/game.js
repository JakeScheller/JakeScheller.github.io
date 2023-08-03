import Stats from "stats.js";
import {Renderer} from "./renderer.js";
import {World} from "./world.js";


export class Game {

	constructor({renderer, world}) {
		this.renderer = new Renderer({...renderer, canvas: document.getElementById("canvas")});
		this.world = new World(world);

		this._stats = new Stats();
		this._stats.showPanel(1);
		document.getElementById("info").appendChild(this._stats.dom);
	}

	async load() {
		await this.world.load();
		this.renderer.loop.start(this._mainLoop.bind(this));
	};

	_mainLoop(timestamp, deltatime) {
		this._stats.begin();
		this.world.player.update(deltatime);
		this.renderer.render(this.world.getScene(), this.world.getCamera());
		this._stats.end();
	}
}