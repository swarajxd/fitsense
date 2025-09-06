import "./Features.css";
import ReactCompareImage from "react-compare-image";
import img6 from "../../public/Feature22.jpg";
import img5 from "../../public/FEATURE2.png";

export default function Features() {
  return (
    <>
      <div className="feature-container">
        <div className="features-body">
          <p className="feature-text2">Smart recommendations</p>
          <h1 className="feature-text1">Always on trend, always your style.</h1>
          <div className="featuresthreebox">
            <div className="featurebox">
             <video
    className="thefeaturevideo"
    src="/Feature11.mp4"
    autoPlay
    loop
    muted
    playsInline
  />
            </div>
            <div className="featurebox">
              <ReactCompareImage
        leftImage={img5}     // replace with your "Visible to you" image
        rightImage={img6}  // replace with your "Invisible to others" image
        sliderLineColor="#000"
        sliderLineWidth={3}
      />
            </div>
            <div className="featurebox"> 
              <img className="thefeaturevideo1" src="/Feature3.jpg"></img>
            </div>
          </div>
          <div className="featuresthreetextbox">
            <div className="featuretextbox">
            <h1 className="featuretextsforbox">
              <span className="darkfeatures">Social Media for Fashion.</span> Fitsense is your <br/>fashion community, where you share looks,<br/>follow icons, and engage with fashion <br/>worldwide.
            </h1>
            </div>
            <div className="featuretextbox">
              <h1 className="featuretextsforbox">
              <span className="darkfeatures">Smart style picks.</span> Fitsense learns your preferences and recommends outfits, keeping you unique and ahead of fashion trends effortlessly.
            </h1>
            </div>
            <div className="featuretextbox">
              <h1 className="featuretextsforbox">
              <span className="darkfeatures">Discover new trends.</span> Browse curated feeds of real people’s fashion, explore diverse wardrobes, and let your next look be inspired by the community.
            </h1>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
