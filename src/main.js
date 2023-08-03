import {Game} from "./game.js";

const game = new Game({
	renderer: {
		fps: 60
	},
	world: {
		environment: {
			skybox: "skybox",
			model: "environment.glb"
		},
		player: {
			position: {
				x: 0,
				y: 0,
				z: 0
			},
			rotation: {
				h: 0,
				v: -0.3
			},
			camera: {
				fov: 45,
				height: 1.62
			}
		}
	}
});

game.load();