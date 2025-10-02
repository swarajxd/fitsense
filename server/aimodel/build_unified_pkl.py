import argparse
import io
import torch
from pathlib import Path
from dataclasses import dataclass


@dataclass
class UnifiedConfig:
    color_model_name: str = "prithivMLmods/Fashion-Product-baseColour"
    pattern_model_name: str = "IrshadG/Clothes_Pattern_Classification_v2"
    season_model_name: str = "prithivMLmods/Fashion-Product-Season"


class UnifiedFashionModel(torch.nn.Module):
    """Serializable wrapper that reconstructs detection and loads HF heads lazily on first use.

    We store detection state_dict and HF model identifiers in the pickle. On load, we rebuild models.
    """

    def __init__(self, det_state_dict: dict, num_classes: int, cfg: UnifiedConfig):
        super().__init__()
        self.det_state = det_state_dict
        self.num_classes = int(num_classes)
        self.cfg = cfg

        # Defer heavy construction to first forward
        self._det_model = None
        self._color = None
        self._pattern = None
        self._season = None

    def _build_det(self, device: torch.device):
        if self._det_model is None:
            from torchvision.models.detection import maskrcnn_resnet50_fpn
            m = maskrcnn_resnet50_fpn(weights=None, num_classes=self.num_classes)
            m.load_state_dict(self.det_state, strict=True)
            self._det_model = m.to(device).eval()
        return self._det_model

    def _build_color(self):
        if self._color is None:
            from transformers import AutoImageProcessor, AutoModelForImageClassification
            model = AutoModelForImageClassification.from_pretrained(self.cfg.color_model_name)
            proc = AutoImageProcessor.from_pretrained(self.cfg.color_model_name)
            model.eval()
            self._color = (model, proc)
        return self._color

    def _build_pattern(self):
        if self._pattern is None:
            from transformers import AutoImageProcessor, AutoModelForImageClassification
            model = AutoModelForImageClassification.from_pretrained(self.cfg.pattern_model_name)
            proc = AutoImageProcessor.from_pretrained(self.cfg.pattern_model_name)
            model.eval()
            self._pattern = (model, proc)
        return self._pattern

    def _build_season(self):
        if self._season is None:
            from transformers import AutoImageProcessor
            from transformers import SiglipForImageClassification
            model = SiglipForImageClassification.from_pretrained(self.cfg.season_model_name)
            proc = AutoImageProcessor.from_pretrained(self.cfg.season_model_name)
            model.eval()
            self._season = (model, proc)
        return self._season

    @torch.no_grad()
    def forward(self, images, run_color=False, run_pattern=False, run_season=False):
        """images: list[Tensor CxHxW]. Returns list of dict per image with detection and optional attrs."""
        device = next(self.parameters()).device if any(p.requires_grad for p in self.parameters()) else torch.device("cuda" if torch.cuda.is_available() else "cpu")
        det = self._build_det(device)
        outs = det(images)

        results = []
        for img_tensor, out in zip(images, outs):
            entry = {
                "boxes": out.get("boxes"),
                "labels": out.get("labels"),
                "scores": out.get("scores"),
            }
            C, H, W = img_tensor.shape
            # Optional heads operate per detection crop
            if any([run_color, run_pattern, run_season]):
                from torchvision.ops import roi_align
                boxes = out.get("boxes")
                if boxes is not None and boxes.numel() > 0:
                    # Normalize ROIs to extract crops; use simple tensor slicing fallback for speed
                    crops = []
                    for b in boxes:
                        x1, y1, x2, y2 = [int(v.item()) for v in b]
                        x1 = max(0, x1); y1 = max(0, y1); x2 = min(W, x2); y2 = min(H, y2)
                        crop = img_tensor[:, y1:y2, x1:x2].cpu()
                        crops.append(crop)
                else:
                    crops = []

                # Convert crops to PIL for transformers processors
                from torchvision.transforms.functional import to_pil_image
                pil_crops = [to_pil_image(c) for c in crops]

                if run_color and len(pil_crops) > 0:
                    model, proc = self._build_color()
                    import torch as _t
                    from torch.nn.functional import softmax as _softmax
                    labels = []
                    for im in pil_crops:
                        inputs = proc(images=im, return_tensors="pt")
                        logits = model(**inputs).logits
                        probs = _softmax(logits, dim=-1)
                        idx = int(_t.argmax(probs, dim=-1).item())
                        label = model.config.id2label[idx]
                        conf = float(probs[0, idx].item())
                        labels.append({"label": label, "score": round(conf, 4)})
                    entry["color"] = labels

                if run_pattern and len(pil_crops) > 0:
                    model, proc = self._build_pattern()
                    import torch as _t
                    from torch.nn.functional import softmax as _softmax
                    labels = []
                    for im in pil_crops:
                        inputs = proc(images=im, return_tensors="pt")
                        logits = model(**inputs).logits
                        probs = _softmax(logits, dim=-1)
                        idx = int(_t.argmax(probs, dim=-1).item())
                        label = model.config.id2label[idx]
                        conf = float(probs[0, idx].item())
                        labels.append({"label": label, "score": round(conf, 4)})
                    entry["pattern"] = labels

                if run_season and len(pil_crops) > 0:
                    model, proc = self._build_season()
                    import torch as _t
                    from torch.nn.functional import softmax as _softmax
                    id2label = {0: "Fall", 1: "Spring", 2: "Summer", 3: "Winter"}
                    labels = []
                    for im in pil_crops:
                        inputs = proc(images=im, return_tensors="pt")
                        logits = model(**inputs).logits
                        probs = _softmax(logits, dim=-1)
                        idx = int(_t.argmax(probs, dim=-1).item())
                        label = id2label.get(idx, str(idx))
                        conf = float(probs[0, idx].item())
                        labels.append({"label": label, "score": round(conf, 4)})
                    entry["season"] = labels

            results.append(entry)
        return results


def main():
    parser = argparse.ArgumentParser(description="Build a unified PKL with detection + color/pattern/season")
    parser.add_argument("--ckpt", required=True, help="Path to detection checkpoint (.pth)")
    parser.add_argument("--out", type=str, default="fashionrecs/unified_model.pkl")
    parser.add_argument("--color_model", type=str, default=UnifiedConfig.color_model_name)
    parser.add_argument("--pattern_model", type=str, default=UnifiedConfig.pattern_model_name)
    parser.add_argument("--season_model", type=str, default=UnifiedConfig.season_model_name)
    args = parser.parse_args()

    state = torch.load(args.ckpt, map_location="cpu")
    sd = state.get("model", state)
    cls_w = sd.get("roi_heads.box_predictor.cls_score.weight")
    if cls_w is None:
        raise RuntimeError("Unexpected checkpoint format: missing predictor weights")
    num_classes = int(cls_w.shape[0])

    cfg = UnifiedConfig(color_model_name=args.color_model, pattern_model_name=args.pattern_model, season_model_name=args.season_model)
    wrapper = UnifiedFashionModel(det_state_dict=sd, num_classes=num_classes, cfg=cfg)

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    torch.save(wrapper, out_path, pickle_protocol=4)
    print(f"Saved unified PKL to {out_path}")


if __name__ == "__main__":
    main()


