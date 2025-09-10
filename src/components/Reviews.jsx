import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import './Review.css';

const testimonials = [
  {
    id: 1,
    quote: "I've never felt more confident in my style! The pieces are not only comfortable but also incredibly fashionable.",
    author: "Sarah J.",
    role: "Fashion Enthusiast",
    image: "/Review1.jpg"
  },
  {
    id: 2,
    quote: "The quality exceeded my expectations. Every piece I've bought has become a staple in my wardrobe.",
    author: "Emily R.",
    role: "Style Blogger",
    image: "/Review2.jpg"
  },
  {
    id: 3,
    quote: "Amazing customer service and trendy designs. I always get compliments when wearing their pieces!",
    author: "Jessica M.",
    role: "Fashion Designer",
    image: "/Review3.jpg"
  }
];

const Reviews = () => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const nextTestimonial = () => {
    setCurrentIndex((prev) => (prev + 1) % testimonials.length);
  };

  const prevTestimonial = () => {
    setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  const goToTestimonial = (index) => {
    setCurrentIndex(index);
  };

  const currentTestimonial = testimonials[currentIndex];

  return (
    <section className="testimonial-section">
      <div className="testimonial-container">
        <div className="testimonial-content">
          <div className="testimonial-badge">Testimonial</div>
          
          <h2 className="testimonial-heading">
            Hear What Our
            <br />
            Customers Love!
          </h2>
          <p className='commasa'>"</p>
          <blockquote className="testimonial-quote">
            {currentTestimonial.quote}
          </blockquote>
          
          <div className="testimonial-author">
            <h3 className="testimonial-name">{currentTestimonial.author}</h3>
            <p className="testimonial-role">{currentTestimonial.role}</p>
          </div>
          
          <div className="testimonial-navigation">
            <button 
              className="nav-button" 
              onClick={prevTestimonial}
              disabled={currentIndex === 0}
              aria-label="Previous testimonial"
            >
              <ChevronLeft size={24} />
            </button>
            
            <div className="pagination-dots">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  className={`pagination-dot ${index === currentIndex ? 'active' : ''}`}
                  onClick={() => goToTestimonial(index)}
                  aria-label={`Go to testimonial ${index + 1}`}
                />
              ))}
            </div>
            
            <button 
              className="nav-button" 
              onClick={nextTestimonial}
              disabled={currentIndex === testimonials.length - 1}
              aria-label="Next testimonial"
            >
              <ChevronRight size={24} />
            </button>
          </div>
        </div>
        
        <div className='boxyofreview'>
          <img 
            src={currentTestimonial.image}
            alt={`${currentTestimonial.author} - ${currentTestimonial.role}`}
            className="testimonial-image"
          />
        </div>
      </div>
    </section>
  );
};

export default Reviews;
