import * as React from 'react';

const Popup: React.FC = () => {
  return (
    <section
      id="popup"
      style={{padding: 10, textAlign: 'center', fontFamily: 'sans-serif'}}
    >
      <div style={{display: 'inline-block', paddingRight: 5}}>
        <img src="../assets/icons/favicon-48.png" alt="🌈" />
      </div>
      <p style={{fontSize: '14pt'}}>Express Executions</p>
      <p style={{fontSize: '10pt'}}>
        🙋‍♂️ Made by{' '}
        <a
          href="https://twitter.com/zaccharles"
          target="_blank"
          rel="noreferrer"
          style={{color: '#2874fc'}}
        >
          @zaccharles
        </a>
      </p>
      <br />
      <div className="links__holder">
        <a
          href="https://www.buymeacoffee.com/zaccharles"
          target="_blank"
          rel="noreferrer"
        >
          <img
            src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png"
            alt="Buy Me A Coffee"
            height={60}
            width={217}
          />
        </a>
      </div>
    </section>
  );
};

export default Popup;
