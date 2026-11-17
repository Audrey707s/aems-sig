import {describe,expect,it} from "vitest";
import {locationForest} from "@/lib/location-diagram";
import {layoutHierarchy} from "@/lib/hierarchy-diagram";
const row=(id:string,parent_id:string|null=null,is_active=true)=>({id,parent_id,is_active,code:id,name:id});
describe("Location diagram",()=>{
 it("preserves hierarchy, inactive and orphaned locations",()=>{const root=locationForest([row("factory"),row("area","factory"),row("mill","area",false),row("orphan","missing")]);expect(root.children.map(n=>n.id)).toEqual(["factory","orphan"]);expect(root.children[0].children[0].children[0].status).toBe("INACTIVE");});
 it("retains every location exactly once even for malformed cycles",()=>{const root=locationForest([row("a","b"),row("b","a")]);expect(layoutHierarchy(root).nodes.map(n=>n.node.id).sort()).toEqual(["__locations__","a","b"]);});
 it("collapses a branch while retaining paths to search results",()=>{const root=locationForest([row("a"),row("b","a"),row("c","b")]);expect(layoutHierarchy(root,new Set(["a"])).nodes.map(n=>n.node.id)).toEqual(["__locations__","a"]);expect(layoutHierarchy(root).nodes.find(n=>n.node.id==="c")?.path).toEqual(["__locations__","a","b"]);});
 it("supports an empty location list",()=>expect(locationForest([]).children).toEqual([]));
});
