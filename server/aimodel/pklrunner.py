import argparse
from pathlib import Path
import torch
import torchvision.transforms as T
from PIL import Image, ImageDraw
from torch.serialization import safe_globals
from torchvision.models.detection.mask_rcnn import MaskRCNN
from torchvision.models.detection import maskrcnn_resnet50_fpn
try:
    # Import classes used by the unified PKL so they can be allowlisted during unpickling
    from build_unified_pkl import UnifiedFashionModel, UnifiedConfig
except Exception:
    UnifiedFashionModel = None  # type: ignore
    UnifiedConfig = None  # type: ignore


def load_model(model_path: str, device: str):
    # Try unified wrapper first (allowlist its class and force full pickle load)
    try:
        allow = []
        if UnifiedFashionModel is not None:
            allow.append(UnifiedFashionModel)
        if UnifiedConfig is not None:
            allow.append(UnifiedConfig)
        with safe_globals(allow):
            mdl = torch.load(model_path, map_location=device, weights_only=False)
        if UnifiedFashionModel is not None and isinstance(mdl, UnifiedFashionModel):
            return mdl
    except Exception:
        pass

    # Allowlist MaskRCNN and load full pickled model
    try:
        with safe_globals([MaskRCNN]):
            model = torch.load(model_path, map_location=device, weights_only=False)
        if hasattr(model, "eval"):
            model.eval()
        return model
    except Exception:
        pass

    # Final fallback: force full pickle load without allowlist (only if you trust the file)
    try:
        mdl = torch.load(model_path, map_location=device, weights_only=False)
        if hasattr(mdl, "eval"):
            mdl.eval()
        return mdl
    except Exception as e:
        raise RuntimeError(f"Failed to load model: {e}")


def load_image(image_path: str):
    image = Image.open(image_path).convert("RGB")
    transform = T.Compose([
        T.ToTensor(),
    ])
    tensor = transform(image)
    return image, tensor


def draw_boxes(image: Image.Image, boxes, labels=None, scores=None, topk: int = 10):
    draw = ImageDraw.Draw(image)
    n = min(topk, len(boxes))
    for i in range(n):
        box = boxes[i]
        x1, y1, x2, y2 = [float(v) for v in box]
        draw.rectangle([x1, y1, x2, y2], outline=(255, 0, 0), width=2)
        if labels is not None or scores is not None:
            txt = []
            if labels is not None:
                txt.append(str(int(labels[i])))
            if scores is not None:
                txt.append(f"{float(scores[i]):.2f}")
            if txt:
                draw.text((x1 + 2, y1 + 2), " ".join(txt), fill=(255, 0, 0))
    return image


def main():
    current_dir = str(Path(__file__).parent.resolve())
    parser = argparse.ArgumentParser(description="Test a pickled model on an image (supports Unified PKL)")
    parser.add_argument("--model", type=str, default=str(Path(current_dir) / "unified_model.pkl"))
    parser.add_argument("--image", type=str, default=r"C:\Users\PRAKYAT\Downloads\dc6dcd611fcd3456e9639c6ec008af60.jpg")
    parser.add_argument("--device", type=str, default=("cuda" if torch.cuda.is_available() else "cpu"))
    parser.add_argument("--topk", type=int, default=10)
    parser.add_argument("--save", type=str, default="")
    # Unified options
    parser.add_argument("--run_color", action="store_true", default=True)
    parser.add_argument("--run_pattern", action="store_true", default=True)
    parser.add_argument("--run_season", action="store_true", default=True)
    parser.add_argument("--json_out", type=str, default=str(Path(current_dir) / "results.json"), 
                       help="Optional path to save unified JSON like fashion_out.json")
    parser.add_argument("--classes_json", type=str, default=str(Path(current_dir) / "df2_classes.json"), 
                       help="Optional JSON file with class names array (DeepFashion2 order, excluding background)")
    parser.add_argument("--score_thr", type=float, default=0.7)
    args = parser.parse_args()

    model = load_model(args.model, args.device)
    image, tensor = load_image(args.image)

    # Support unified wrapper
    if hasattr(model, "__class__") and model.__class__.__name__ == "UnifiedFashionModel":
        inputs = [tensor.to(args.device)]
        with torch.no_grad():
            outputs = model(inputs, run_color=args.run_color, run_pattern=args.run_pattern, run_season=args.run_season)
        out0 = outputs[0]
        boxes = out0.get("boxes")
        labels = out0.get("labels")
        scores = out0.get("scores")
    else:
        # torchvision detection
        inputs = [tensor.to(args.device)]
        with torch.no_grad():
            outputs = model(inputs)
        out0 = {k: (v.detach().cpu() if torch.is_tensor(v) else v) for k, v in outputs[0].items()}
        boxes = out0.get("boxes")
        labels = out0.get("labels")
        scores = out0.get("scores")

    if isinstance(boxes, torch.Tensor):
        boxes = boxes.detach().cpu()
    if isinstance(labels, torch.Tensor):
        labels = labels.detach().cpu()
    if isinstance(scores, torch.Tensor):
        scores = scores.detach().cpu()

    print("Keys in output:", list(out0.keys()))
    print("Boxes:", boxes)
    print("Labels:", labels)
    print("Scores:", scores)

    if args.save and boxes is not None:
        save_path = Path(args.save)
        save_path.parent.mkdir(parents=True, exist_ok=True)
        vis = draw_boxes(image.copy(), boxes, labels, scores, topk=args.topk)
        vis.save(save_path)
        print(f"Saved visualization to {save_path}")

    # Optional JSON output in the user's expected format
    if args.json_out and boxes is not None and labels is not None and scores is not None:
        try:
            # Resolve class-name mapping
            DF2_CLASSES = None
            # 1) User-provided mapping
            if args.classes_json:
                try:
                    import json as _json
                    with open(args.classes_json, "r", encoding="utf-8") as cf:
                        arr = _json.load(cf)
                        if isinstance(arr, list) and all(isinstance(x, str) for x in arr):
                            DF2_CLASSES = arr
                except Exception as _:
                    DF2_CLASSES = None
            # 2) Fallback to training module constant if available
            if DF2_CLASSES is None:
                try:
                    from fashionrecs.scripts.train_df2_maskrcnn import DF2_CLASSES as _DF2  # type: ignore
                    DF2_CLASSES = _DF2
                except Exception:
                    DF2_CLASSES = None  # type: ignore

            import json
            import numpy as np
            b = boxes.numpy() if hasattr(boxes, 'numpy') else boxes
            l = labels.numpy() if hasattr(labels, 'numpy') else labels
            s = scores.numpy() if hasattr(scores, 'numpy') else scores
            idx = np.where(s >= args.score_thr)[0]
            idx = idx[np.argsort(s[idx])[::-1]]
            if args.topk and len(idx) > args.topk:
                idx = idx[:args.topk]

            items = []
            for rank, i in enumerate(idx):
                cls_id = int(l[i])
                if DF2_CLASSES and 0 < cls_id <= len(DF2_CLASSES):
                    cls_name = DF2_CLASSES[cls_id - 1]
                else:
                    cls_name = str(cls_id)

                # If unified wrapper produced per-crop attrs
                color = None
                pattern = None
                season = None
                if hasattr(model, "__class__") and model.__class__.__name__ == "UnifiedFashionModel":
                    colors = out0.get("color") or []
                    patterns = out0.get("pattern") or []
                    seasons = out0.get("season") or []
                    if rank < len(colors) and isinstance(colors[rank], dict):
                        color = colors[rank]
                    if rank < len(patterns) and isinstance(patterns[rank], dict):
                        pattern = patterns[rank]
                    if rank < len(seasons) and isinstance(seasons[rank], dict):
                        season = seasons[rank]

                items.append({
                    "crop_file": f"det_{rank:02d}_crop.jpg",
                    "det_label": cls_name,
                    "det_score": float(s[i]),
                    "color": color or {"label": None, "score": None},
                    "pattern": pattern or {"label": None, "score": None},
                    "season": season or {"label": None, "score": None},
                })

            out_json = {"items": items}
            out_path = Path(args.json_out)
            out_path.parent.mkdir(parents=True, exist_ok=True)
            with open(out_path, "w", encoding="utf-8") as f:
                json.dump(out_json, f, indent=2)
            print(f"Saved JSON to {out_path}")
        except Exception as e:
            print(f"Failed to write JSON: {e}")


if __name__ == "__main__":
    main()
