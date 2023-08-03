import * as THREE from "three";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";
import {Player} from "./player.js";


export class World {

	constructor({environment, player}) {
		this.environment = new Environment(environment);
		this.player = new Player(player);

		this._scene = new THREE.Scene();
		// this._scene.add(new THREE.AxesHelper(100));

		const light = new THREE.DirectionalLight(0xffffff, 0.5);
		light.position.set(-1, 1, -1);
		this._scene.add(light);

		const light2 = new THREE.AmbientLight(0xffffff, 0.4);
		this._scene.add(light2);

		const light3 = new THREE.PointLight(0xffffff, 0.3);
		light3.position.set(0, 3.75, 1.75);
		this._scene.add(light3);
	}

	async load() {
		const model = await this.environment.loadModel();
		this._scene.add(model);

		const skybox = this.environment.loadSkybox();
		this._scene.background = skybox;
	}

	getScene() {
		return this._scene;
	}

	getCamera() {
		return this.player._camera;
	}
}


class Environment {

	constructor({model, skybox}) {
		this._model_path = model;
		this._model_loaded = false;

		this._skybox_path = skybox;
		this._skybox_loaded = false;
	}

	async loadModel() {
		if (this._model_loaded) return;

		const loader = new GLTFLoader();

		return new Promise((resolve, reject) => {
			loader.load(
				this._model_path,
				(gltf) => {
					this._model_loaded = true;
					resolve(gltf.scene);
				},
				(xhr) => {
					const percent_done = (xhr.loaded / xhr.total * 100).toFixed(2);
					console.log(`Loading mesh ${this._model_path}: ${percent_done}% done`);
				},
				(error) => {
					reject(error);
				}
			);
		});
	}

	loadSkybox() {
		if (this._skybox_loaded) return;

		const loader = new THREE.CubeTextureLoader();
		loader.setPath(this._skybox_path);

		const texture_cube = loader.load([
			"/px.jpg", "/nx.jpg",
			"/py.jpg", "/ny.jpg",
			"/pz.jpg", "/nz.jpg"
		]);

		return texture_cube;
	}
}