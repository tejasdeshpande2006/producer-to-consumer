import React from 'react';

interface P2CLogoProps {
  className?: string;
}

const P2CLogo: React.FC<P2CLogoProps> = ({ className = "w-8 h-8" }) => (
  <svg
    viewBox="0 0 40 40"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Shopping Bag */}
    <path
      d="M8 14H32L30 34H10L8 14Z"
      stroke="white"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    {/* Bag Handles */}
    <path
      d="M14 14V10C14 7.79086 15.7909 6 18 6H22C24.2091 6 26 7.79086 26 10V14"
      stroke="white"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    {/* Leaf inside bag - representing fresh/organic produce */}
    <path
      d="M20 18C20 18 16 22 16 26C18 24 20 22 20 22C20 22 22 24 24 26C24 22 20 18 20 18Z"
      stroke="white"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="white"
      fillOpacity="0.3"
    />
    <path
      d="M20 22V28"
      stroke="white"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

export default P2CLogo;
