/** @param {NS} ns */
export async function main(ns) {
	let allNodes = await walkNetworkDFS(ns);
	//ns.tprint("found " + allNodes.length + " nodes");
	//await ns.write("allNodesDFS.txt", allNodes.join("\n"), "w");
}

/** Walk the network and return an array of all hosts.
 * 
 * @param {NS} ns
 */
export async function walkNetworkBFS(ns) {
	let root = "home";
	let q = [];
	let explored = new Set();
	
	explored.add(root);
	q.push(root);

	while (q.length > 0) {
		let v = q.shift();

		let edges = ns.scan(v);

		for (const w of edges) {
			if (!explored.has(w)) {
				explored.add(w);
				q.push(w);
			}
		}
		await ns.sleep(10);
	}
	return Array.from(explored.values());
}

export async function walkNetworkDFS(ns) {
	let root = "home";
	let s = [];
	let explored = new Set();
	
	explored.add(root);
	s.push(root);

	while (s.length > 0) {
		let v = s.pop();
		if (v == ".") {
			break;
		}
		let edges = ns.scan(v);

		for (const w of edges) {
			if (!explored.has(w)) {
				explored.add(w);
				s.push(w);
			}
		}
		await ns.sleep(10);
	}
	return Array.from(explored.values());
}

class Node {
	constructor(value) {
		this.value = value;
		this.children = [];
	}

	addChild(value) {
		this.children.push(new Node(value));
		return this;
	}
}