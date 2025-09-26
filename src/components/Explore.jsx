import "./Explore.css";

export default function Explore() {
  return (
    <>
      <div className="explore-container">
        <img className="icons3" src="/icons3.png"></img>
        <div className="explore-randomdiv1">
          <p className="explore-randomtext1">Explore Us</p>
          <h1 className="explore-randomtext2">
            Why You
            <br />
            Should
            <br /> Choose Us
          </h1>
        </div>
        <div className="explorecard-container">
          <div className="explorecard-alt">
            <img className="imgcardbox5" src="../../public/cardbox5.png"></img>
          </div>
        </div>
        <div className="explore-randomdiv2">
          <h1 className="random-points">AI-Powered Fashion Engine</h1>
          <h1 className="random-points">Real-Time Recommendation</h1>
          <h1 className="random-points">Data-Driven Personalization</h1>
       
          <h1 className="random-points">Sustainability Metric</h1>
          <h1 className="random-points">Scalable Cloud Infrastructure</h1>
        </div>
        <p className="explore-randomtext3">
          At Fitsense, we combine AI-driven fashion insights with <br/>personalized style recommendations tailored just for you.<br/>From matching outfits to complementing accessories, we <br/>ensure every look is effortlessly stylish, sustainable, <br/>and uniquely yours.
        </p>
      </div>
    </>
  );
}
