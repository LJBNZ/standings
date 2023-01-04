import styled from "styled-components";

const StyledSelect = styled.select`
    font-family: 'Inconsolata';
`
function GraphOption(props) {

    const handleChange = event => {
        props.setter(event.target.value);
    }

    var options = [];
    for (const [key, value] of Object.entries(props.options)) {
        options.push(<option key={value} value={value}>{value}</option>);
    }

    return (
        <StyledSelect defaultValue={props.selected} name={props.name} onChange={handleChange}>
            {options}
        </StyledSelect>
    );
}

export default GraphOption;