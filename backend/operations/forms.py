import re
from django import forms
from .models import Equipment, Agent


class EquipmentForm(forms.ModelForm):
    class Meta:
        model = Equipment
        exclude = ["archived", "last_seen", "updated_at"]

    def clean(self):
        data = super().clean()
        if data.get("maintenance") == "scheduled" and not data.get("next_maintenance"):
            self.add_error(
                "next_maintenance", "Informe a data da manutenção programada."
            )
        return data

    def clean_postal_code(self):
        value = self.cleaned_data["postal_code"]
        if not re.fullmatch(r"\d{5}-?\d{3}", value):
            raise forms.ValidationError("Informe um CEP com oito dígitos.")
        return value

    def clean_state(self):
        value = self.cleaned_data["state"].upper()
        if (
            value
            not in "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split()
        ):
            raise forms.ValidationError("Informe uma UF válida.")
        return value

    def clean_characteristics(self):
        value = self.cleaned_data.get("characteristics") or {}
        if not isinstance(value, dict):
            raise forms.ValidationError("Informe um objeto de características.")
        if "night_vision" in value and not isinstance(value["night_vision"], bool):
            raise forms.ValidationError("Visão noturna deve ser verdadeiro ou falso.")
        if "speed_limit" in value:
            speed = value["speed_limit"]
            if (
                isinstance(speed, bool)
                or not isinstance(speed, (int, float))
                or not 1 <= speed <= 200
            ):
                raise forms.ValidationError(
                    "Limite de velocidade deve estar entre 1 e 200 km/h."
                )
        return value


class AgentForm(forms.ModelForm):
    class Meta:
        model = Agent
        exclude = ["archived", "last_seen", "updated_at"]
